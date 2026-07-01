#!/usr/bin/env node
/**
 * optimize-og.mjs — turn the heavy OG source PNGs into production JPGs.
 *
 * The generated OG cards (public/og/*.png) ship at ~1 MB each, which is wasteful
 * for social preview images. This converts them to quality-tuned JPGs, stepping
 * the JPEG quality down until each file is under the size budget (default 300 KB),
 * then removes the source PNG so only the light JPG ships.
 *
 * Encoder: uses `sharp` if it's installed (best quality + matte control); otherwise
 * falls back to macOS `sips` (zero install). JPEGs are matted onto white so any
 * PNG transparency doesn't flatten to black.
 *
 * Usage:
 *   node tools/optimize-og.mjs                 # public/og/*.png -> *.jpg, <300 KB, delete png
 *   node tools/optimize-og.mjs --max=250       # tighter 250 KB budget
 *   node tools/optimize-og.mjs --dir=public/og/campaigns   # a different folder
 *   node tools/optimize-og.mjs --keep-png      # keep the source PNGs
 *   node tools/optimize-og.mjs --dry-run       # report only, write nothing
 */
import { readdir, stat, unlink, rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, extname, basename } from "node:path";
import { tmpdir } from "node:os";

const execFileP = promisify(execFile);

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : def;
};
const has = (name) => args.includes(`--${name}`);

const DIR = getArg("dir", "public/og");
const MAX_KB = Number(getArg("max", "300"));
const KEEP_PNG = has("keep-png");
const DRY = has("dry-run");
const QUALITIES = [86, 82, 78, 74, 70, 66, 62, 58, 54, 50, 46];

// ── pick an encoder ─────────────────────────────────────────────────────────
let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  /* sharp not installed — fall back to sips */
}

let useSips = false;
if (!sharp) {
  try {
    await execFileP("sips", ["--help"]);
    useSips = true;
  } catch {
    console.error(
      "No encoder available. Install sharp (`pnpm add -D sharp`) or run on macOS (sips).",
    );
    process.exit(1);
  }
}
const encoder = sharp ? "sharp" : "sips";

/** Encode `input` PNG to a JPEG buffer at quality q (matted on white). */
async function encode(input, q) {
  if (sharp) {
    return sharp(input)
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: q, mozjpeg: true, progressive: true })
      .toBuffer();
  }
  // sips writes to a file; round-trip through a temp path.
  const tmp = join(tmpdir(), `og-${process.pid}-${q}.jpg`);
  await execFileP("sips", [
    "-s", "format", "jpeg",
    "-s", "formatOptions", String(q),
    input, "--out", tmp,
  ]);
  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(tmp);
  await unlink(tmp).catch(() => {});
  return buf;
}

/** Find the highest-quality encode that fits the budget (or the smallest we can). */
async function bestUnderBudget(input) {
  const budget = MAX_KB * 1024;
  let last = null;
  for (const q of QUALITIES) {
    const buf = await encode(input, q);
    last = { buf, q };
    if (buf.length <= budget) return { ...last, underBudget: true };
  }
  return { ...last, underBudget: false }; // smallest we could manage
}

// ── run ─────────────────────────────────────────────────────────────────────
const kb = (n) => (n / 1024).toFixed(0);
let entries;
try {
  entries = (await readdir(DIR)).filter((f) => extname(f).toLowerCase() === ".png");
} catch {
  console.error(`Cannot read directory: ${DIR}`);
  process.exit(1);
}

if (!entries.length) {
  console.log(`No PNGs to optimize in ${DIR}.`);
  process.exit(0);
}

console.log(
  `Optimizing ${entries.length} PNG(s) in ${DIR} via ${encoder} (budget ${MAX_KB} KB)${DRY ? " [dry-run]" : ""}\n`,
);

let before = 0;
let after = 0;
let overBudget = 0;
for (const file of entries.sort()) {
  const pngPath = join(DIR, file);
  const jpgPath = join(DIR, `${basename(file, ".png")}.jpg`);
  const srcKb = (await stat(pngPath)).size;
  const { buf, q, underBudget } = await bestUnderBudget(pngPath);
  before += srcKb;
  after += buf.length;
  if (!underBudget) overBudget++;

  const flag = underBudget ? "" : "  ⚠ over budget";
  console.log(
    `  ${file.padEnd(28)} ${kb(srcKb).padStart(5)} KB  →  ${kb(buf.length).padStart(4)} KB  (q${q})${flag}`,
  );

  if (DRY) continue;
  const tmp = `${jpgPath}.tmp`;
  await writeFile(tmp, buf);
  await rename(tmp, jpgPath);
  if (!KEEP_PNG) await unlink(pngPath);
}

console.log(
  `\nTotal ${kb(before)} KB → ${kb(after)} KB` +
    (before ? ` (${Math.round((1 - after / before) * 100)}% smaller)` : "") +
    (KEEP_PNG || DRY ? "" : "  ·  source PNGs removed") +
    (overBudget ? `  ·  ${overBudget} still over ${MAX_KB} KB` : ""),
);
