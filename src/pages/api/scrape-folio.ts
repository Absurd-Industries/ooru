/**
 * Scrapes public GitHub + Notion data for a project folio preview.
 * Returns a structured JSON suitable for previewing before running
 * the full local folio-builder CLI tool.
 *
 * POST body: { repo, notionBuildGuide?, notionOnboarding?, shop?, pcbPath? }
 * Public data only. No tokens.
 */
export const prerender = false;

import type { APIRoute } from "astro";

const UA = "ooru-dev-tools/1.0 (+https://ooru.build)";

async function getJSON(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function getText(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function dashifyId(id: string) {
  const s = id.replace(/-/g, "");
  if (s.length !== 32) return id;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

async function fetchNotionBlocks(pageId: string) {
  const id = dashifyId(pageId);
  const blocks: Record<string, Record<string, unknown>> = {};
  let spaceId: string | null = null;
  let prevCount = -1;
  for (let chunk = 0; chunk < 5; chunk++) {
    let data: Record<string, unknown>;
    try {
      const r = await fetch("https://www.notion.so/api/v3/loadPageChunk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({ pageId: id, limit: 100, cursor: { stack: [] }, chunkNumber: chunk, verticalColumns: false }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) break;
      data = await r.json() as Record<string, unknown>;
    } catch { break; }
    const recs = (data?.recordMap as Record<string, unknown>)?.block as Record<string, Record<string, unknown>> | undefined ?? {};
    for (const [bid, rec] of Object.entries(recs)) {
      const val = (rec.value as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
      if (val) blocks[bid] = val;
      const sid = (rec.value as Record<string, unknown>)?.spaceId as string | undefined;
      if (sid && !spaceId) spaceId = sid;
    }
    const count = Object.keys(blocks).length;
    if (count === prevCount) break;
    prevCount = count;
  }
  // Walk to extract ordered blocks
  const items: { id: string; type: string; text: string; imageUrl: string | null }[] = [];
  const seen = new Set<string>();
  function imgUrl(v: Record<string, unknown>, bid: string): string | null {
    const props = v.properties as Record<string, unknown[][]> | undefined;
    const fmt = v.format as Record<string, unknown> | undefined;
    const src = props?.source?.[0]?.[0] as string | undefined ?? fmt?.display_source as string | undefined;
    if (!src) return null;
    if (!src.includes("amazonaws.com") && !src.includes("secure.notion")) return src;
    return `https://www.notion.so/image/${encodeURIComponent(src)}?table=block&id=${bid}&cache=v2${spaceId ? `&spaceId=${spaceId}` : ""}`;
  }
  function walk(bid: string) {
    if (seen.has(bid)) return;
    seen.add(bid);
    const v = blocks[bid];
    if (!v) return;
    const props = v.properties as Record<string, unknown[][]> | undefined;
    const text = (props?.title ?? []).map((t: unknown[]) => t[0]).join("");
    if (bid !== id) {
      items.push({ id: bid, type: String(v.type ?? ""), text: String(text), imageUrl: v.type === "image" ? imgUrl(v, bid) : null });
    }
    for (const cid of (v.content as string[] | undefined ?? [])) walk(cid);
  }
  if (blocks[id]) walk(id);
  else Object.keys(blocks).forEach(walk);
  return items;
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const repo = String(body.repo ?? "").trim();
  if (!repo || !repo.match(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)) {
    return json({ error: "repo must be in the form owner/repo" }, 400);
  }

  const result: Record<string, unknown> = { repo };

  try {
    const meta = await getJSON(`https://api.github.com/repos/${repo}`);
    const branch = (meta as Record<string, unknown>).default_branch ?? "main";
    result.meta = {
      name: (meta as Record<string, unknown>).name,
      description: (meta as Record<string, unknown>).description,
      stars: (meta as Record<string, unknown>).stargazers_count,
      license: ((meta as Record<string, unknown>).license as Record<string, unknown> | null)?.spdx_id ?? "NOASSERTION",
      htmlUrl: (meta as Record<string, unknown>).html_url,
      branch,
    };

    // Tree (file list)
    const tree = await getJSON(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
    const files = ((tree as Record<string, unknown>).tree as { type: string; path: string }[] ?? [])
      .filter((n) => n.type === "blob")
      .map((n) => n.path);
    result.files = files.filter((p) => /\.(kicad_pcb|kicad_sch|step|stl|csv|pdf|f3d|f3z)$/i.test(p));
    result.imageFiles = files.filter((p) => /\.(png|jpe?g|webp)$/i.test(p) && /(^|\/)img\//i.test(p));

    // README
    try {
      const readme = await getText(`https://raw.githubusercontent.com/${repo}/${branch}/README.md`);
      result.readme = readme.slice(0, 4000);
    } catch { /* no readme */ }

    // KiCanvas URL if pcbPath provided
    if (body.pcbPath) {
      const pcbFile = files.find((f) => f.endsWith(body.pcbPath));
      if (pcbFile) {
        result.pcbViewerUrl = `https://kicanvas.org/?github=${encodeURIComponent(`https://github.com/${repo}/blob/${branch}/${pcbFile}`)}`;
      }
    }

    // Notion pages (if provided)
    if (body.notionBuildGuide) {
      try { result.buildGuide = await fetchNotionBlocks(body.notionBuildGuide); } catch (e) { result.buildGuideError = String(e); }
    }
    if (body.notionOnboarding) {
      try { result.onboarding = await fetchNotionBlocks(body.notionOnboarding); } catch (e) { result.onboardingError = String(e); }
    }

    // CLI command to run locally
    const cfg = {
      slug: (meta as Record<string, unknown>).name,
      title: (meta as Record<string, unknown>).name,
      repo,
      ...(body.shop ? { shop: body.shop } : {}),
      makerSlug: "your-maker-slug",
      ...(body.notionBuildGuide || body.notionOnboarding ? {
        notion: {
          ...(body.notionBuildGuide ? { buildGuide: body.notionBuildGuide } : {}),
          ...(body.notionOnboarding ? { onboarding: body.notionOnboarding } : {}),
        }
      } : {}),
    };
    result.cliCommand = `node tools/folio-builder/build.mjs tools/folio-builder/configs/${cfg.slug}.json`;
    result.configTemplate = cfg;

  } catch (err: unknown) {
    return json({ error: String(err) }, 502);
  }

  return json(result);
};
