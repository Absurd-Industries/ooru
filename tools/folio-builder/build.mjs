#!/usr/bin/env node
/**
 * folio-builder - turn a maker's public links into a project "folio" draft.
 *
 * Given a small JSON config (a GitHub repo, a shop page, optional Notion build
 * guide / onboarding page ids, and the slugs that tie it to a maker/campaign),
 * this fetches everything PUBLIC, downloads + converts every image to webp,
 * converts the CAD model to a web GLB, and emits:
 *
 *   - public/images/projects/<slug>/*.webp      (re-hosted, rot-proof assets)
 *   - public/models/<slug>.glb                  (web 3D model)
 *   - tools/folio-builder/out/<slug>.draft.json (all extracted content)
 *   - a projects.ts skeleton printed to stdout
 *
 * The mechanical, rot-prone work (download/convert/fetch) is fully automated;
 * the narrative shaping of build-guide steps stays human-curated from the draft.
 *
 * Usage:
 *   node tools/folio-builder/build.mjs tools/folio-builder/configs/<slug>.json
 *   node tools/folio-builder/build.mjs <slug>      # shorthand for the config path
 *
 * Public data only. Never put tokens or private URLs in a config.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const UA = "ooru-folio-builder/1.0 (+https://ooru.build)";

// ── config ──────────────────────────────────────────────────────────
let cfgArg = process.argv[2];
if (!cfgArg) {
  console.error("usage: build.mjs <config.json | slug>");
  process.exit(1);
}
if (!cfgArg.endsWith(".json")) cfgArg = join(__dirname, "configs", cfgArg + ".json");
if (!existsSync(cfgArg)) {
  console.error("config not found: " + cfgArg);
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgArg, "utf8"));
const slug = cfg.slug;
const imgDir = join(ROOT, "public", "images", "projects", slug);
const outDir = join(__dirname, "out");
mkdirSync(imgDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const log = (...a) => console.log("·", ...a);
const warn = (...a) => console.warn("!", ...a);

// ── helpers ─────────────────────────────────────────────────────────
async function getJSON(url, opts = {}) {
  const r = await fetch(url, { headers: { "User-Agent": UA, ...(opts.headers || {}) }, ...opts });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** Download a binary URL and convert it to a width-capped webp in imgDir. */
async function saveImage(url, name, maxWidth = 1400) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = (extname(new URL(url).pathname) || ".img").toLowerCase();
    const tmp = join(tmpdir(), `folio-${process.pid}-${name}${ext}`);
    writeFileSync(tmp, buf);
    const outWebp = join(imgDir, name + ".webp");
    // cwebp can't read webp input; for those, normalize via sips to png first.
    let src = tmp;
    if (ext === ".webp") {
      const png = tmp + ".png";
      spawnSync("sips", ["-s", "format", "png", tmp, "--out", png], { stdio: "ignore" });
      if (existsSync(png)) src = png;
    }
    const res = spawnSync(
      "cwebp",
      ["-quiet", "-q", "80", "-resize", String(maxWidth), "0", src, "-o", outWebp],
      { stdio: "ignore" }
    );
    rmSync(tmp, { force: true });
    if (src !== tmp) rmSync(src, { force: true });
    if (res.status !== 0 || !existsSync(outWebp)) throw new Error("cwebp failed");
    log(`image -> ${slug}/${name}.webp`);
    return `/images/projects/${slug}/${name}.webp`;
  } catch (e) {
    warn(`image skipped (${name}): ${e.message}`);
    return null;
  }
}

// ── GitHub ──────────────────────────────────────────────────────────
async function fetchGitHub(repo) {
  log(`github: ${repo}`);
  const meta = await getJSON(`https://api.github.com/repos/${repo}`);
  const branch = meta.default_branch || "main";
  const tree = await getJSON(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`
  );
  const files = (tree.tree || [])
    .filter((n) => n.type === "blob")
    .map((n) => n.path);
  let readme = "";
  try {
    readme = await getText(`https://raw.githubusercontent.com/${repo}/${branch}/README.md`);
  } catch (e) {
    warn("no README: " + e.message);
  }
  // BOM CSV (optional)
  let bom = [];
  if (cfg.bomPath) {
    try {
      const csv = await getText(
        `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURI(cfg.bomPath)}`
      );
      bom = parseCsv(csv);
    } catch (e) {
      warn("no BOM: " + e.message);
    }
  }
  return { meta, branch, files, readme, bom };
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const head = splitCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitCsvLine(l);
    const row = {};
    head.forEach((h, i) => (row[h.trim()] = (cells[i] || "").trim()));
    return row;
  });
}
function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

// ── Notion (public pages, no auth) ──────────────────────────────────
function dashifyId(id) {
  const s = id.replace(/-/g, "");
  if (s.length !== 32) return id;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function fetchNotion(pageId) {
  const id = dashifyId(pageId);
  // Block records arrive as recordMap.block[id].value.value; the page block's
  // `content` array gives document order, with nested children (toggles,
  // columns) reachable through their own content arrays.
  const blocks = {};
  let spaceId = null;
  let prevCount = -1;
  for (let chunk = 0; chunk < 10; chunk++) {
    let data;
    try {
      data = await getJSON("https://www.notion.so/api/v3/loadPageChunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: id,
          limit: 100,
          cursor: { stack: [] },
          chunkNumber: chunk,
          verticalColumns: false,
        }),
      });
    } catch (e) {
      if (chunk === 0) warn("notion fetch failed: " + e.message);
      break;
    }
    const recs = data?.recordMap?.block || {};
    for (const [bid, rec] of Object.entries(recs)) {
      const val = rec.value?.value;
      if (val) blocks[bid] = val;
      if (rec.value?.spaceId && !spaceId) spaceId = rec.value.spaceId;
    }
    const count = Object.keys(blocks).length;
    if (count === prevCount) break; // no new blocks -> done
    prevCount = count;
  }

  const items = [];
  const seen = new Set();
  function imgUrl(v, bid) {
    const src = v.properties?.source?.[0]?.[0] || v.format?.display_source;
    if (!src) return null;
    if (!src.includes("amazonaws.com") && !src.includes("secure.notion")) return src;
    // public-page image proxy resolves signing for us
    return (
      `https://www.notion.so/image/${encodeURIComponent(src)}` +
      `?table=block&id=${bid}&cache=v2${spaceId ? `&spaceId=${spaceId}` : ""}`
    );
  }
  function walk(bid) {
    if (seen.has(bid)) return;
    seen.add(bid);
    const v = blocks[bid];
    if (!v) return;
    const text = (v.properties?.title || []).map((t) => t[0]).join("");
    if (bid !== id) {
      items.push({ id: bid, type: v.type, text, imageUrl: v.type === "image" ? imgUrl(v, bid) : null });
    }
    for (const cid of v.content || []) walk(cid);
  }
  if (blocks[id]) walk(id);
  else Object.keys(blocks).forEach(walk);
  return items;
}

// ── shop page (Shopify) ─────────────────────────────────────────────
async function fetchShop(url) {
  try {
    const html = await getText(url);
    const grab = (re) => (html.match(re) || [])[1] || "";
    const price = grab(/(?:Rs\.|₹)\s*([\d,]+)/);
    const ogTitle = grab(/<meta property="og:title" content="([^"]+)"/);
    const ogDesc = grab(/<meta property="og:description" content="([^"]+)"/);
    return { price, title: ogTitle, description: ogDesc };
  } catch (e) {
    warn("shop fetch failed: " + e.message);
    return {};
  }
}

// ── model ───────────────────────────────────────────────────────────
async function buildModel(repo, branch, m) {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURI(m.stepPath)}`;
  const tmpStep = join(tmpdir(), `folio-${slug}.step`);
  log(`model: downloading ${basename(m.stepPath)}`);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) { warn("model download failed: " + r.status); return null; }
  writeFileSync(tmpStep, Buffer.from(await r.arrayBuffer()));
  const glbOut = join(ROOT, "public", "models", slug + ".glb");
  const res = spawnSync(
    "node",
    [
      join(ROOT, "tools", "step-to-glb.mjs"),
      tmpStep,
      glbOut,
      "--deflection", String(m.deflection ?? 0.4),
      "--max-facets", String(m.maxFacets ?? 140000),
    ],
    { stdio: "inherit" }
  );
  rmSync(tmpStep, { force: true });
  if (res.status === 0 && existsSync(glbOut)) return `/models/${slug}.glb`;
  warn("model conversion failed");
  return null;
}

// ── main ────────────────────────────────────────────────────────────
const gh = await fetchGitHub(cfg.repo);
const shop = cfg.shop ? await fetchShop(cfg.shop) : {};
const buildGuide = cfg.notion?.buildGuide ? await fetchNotion(cfg.notion.buildGuide) : [];
const onboarding = cfg.notion?.onboarding ? await fetchNotion(cfg.notion.onboarding) : [];

// re-host repo images under img/
const repoImages = gh.files.filter((p) => /\.(png|jpe?g|webp)$/i.test(p) && /(^|\/)img\//i.test(p));
const heroImages = [];
let n = 0;
for (const p of repoImages) {
  const url = `https://raw.githubusercontent.com/${cfg.repo}/${gh.branch}/${encodeURI(p)}`;
  const saved = await saveImage(url, `repo-${++n}-${basename(p, extname(p)).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
  if (saved) heroImages.push(saved);
}

// re-host notion images
async function rehostNotion(items, prefix) {
  let i = 0;
  for (const it of items) {
    if (it.imageUrl) {
      const saved = await saveImage(it.imageUrl, `${prefix}-${++i}`);
      it.localImage = saved;
    }
  }
}
await rehostNotion(buildGuide, "guide");
await rehostNotion(onboarding, "onboard");

const model = cfg.model ? await buildModel(cfg.repo, gh.branch, cfg.model) : null;

// downloadable files of interest from the repo
const downloads = gh.files
  .filter((p) => /\.(kicad_pcb|kicad_sch|step|stl|csv|zip|pdf|f3d|f3z)$/i.test(p))
  .map((p) => ({
    name: basename(p),
    path: p,
    url: `https://github.com/${cfg.repo}/raw/${gh.branch}/${encodeURI(p)}`,
  }));

const draft = {
  slug,
  title: cfg.title || gh.meta.name,
  makerSlug: cfg.makerSlug,
  campaignSlug: cfg.campaignSlug,
  repoUrl: gh.meta.html_url,
  shopUrl: cfg.shop || null,
  shop,
  license: gh.meta.license?.spdx_id || gh.meta.license?.name || "NOASSERTION",
  stars: gh.meta.stargazers_count,
  description: gh.meta.description,
  pcbViewerUrl: cfg.pcbPath
    ? `https://kicanvas.org/?github=${encodeURIComponent(`https://github.com/${cfg.repo}/blob/${gh.branch}/${cfg.pcbPath}`)}`
    : null,
  modelUrl: model,
  heroImages,
  bom: gh.bom,
  downloads,
  readme: gh.readme,
  buildGuide,
  onboarding,
};

const draftPath = join(outDir, `${slug}.draft.json`);
writeFileSync(draftPath, JSON.stringify(draft, null, 2));

console.log("\n─────────────────────────────────────────");
console.log(`Folio draft written: ${draftPath}`);
console.log(`Images: ${heroImages.length} hero + notion re-hosted under public/images/projects/${slug}/`);
console.log(`Model:  ${model || "(none)"}`);
console.log(`Files:  ${downloads.length} downloadable repo files`);
console.log(`License (GitHub-reported): ${draft.license}`);
console.log("\nNext: shape draft.json into a Project entry in src/data/projects.ts");
console.log("─────────────────────────────────────────");
