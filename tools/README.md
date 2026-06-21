# ooru.build tools

A small suite of authoring tools for building out the site. Everything here works
on **public data only** - never feed a tool a private URL or a token.

There are two ways to run the tooling:

- **In the browser** via the `/dev` dashboard (kraft-themed, `noindex`). Best for
  quick scrapes and copy-paste blocks. Runs server-side scraping through the SSR
  API routes, so there's no CORS-proxy limitation.
- **On the command line** via the scripts below. Required for anything that the
  browser/Cloudflare Worker can't do - CAD conversion and bulk image re-hosting.

The split exists because a Cloudflare Worker can fetch URLs but cannot run FreeCAD
or shell out to image converters. So the heavy, rot-prone asset work lives in CLI
tools, and the dashboard delegates to them by printing the exact command to run.

---

## `folio-builder/build.mjs`

Turns a maker's public links into a **project folio draft** - the data + assets for
a `/projects/<slug>` page. This is the generic, reusable path: point it at any open
hardware repo and it does the mechanical work.

```bash
node tools/folio-builder/build.mjs cory-dora
# or an explicit path:
node tools/folio-builder/build.mjs tools/folio-builder/configs/cory-dora.json
```

A config (`configs/<slug>.json`) is tiny - a GitHub repo, an optional shop URL,
optional Notion build-guide / onboarding page ids, the CAD model path, and the
slugs tying it to a maker/campaign. See `configs/cory-dora.json` for the shape.

What it produces:

- `public/images/projects/<slug>/*.webp` - every repo + Notion image, re-hosted and
  width-capped. **This is the point**: Notion's image URLs are expiring S3 links, so
  re-hosting is what keeps a folio page from breaking next week.
- `public/models/<slug>.glb` - the CAD model converted for the web (via `step-to-glb`).
- `tools/folio-builder/out/<slug>.draft.json` - all extracted content (README, BOM,
  ordered build-guide + onboarding blocks with local image paths, downloadable files).

The draft's narrative blocks (build-guide steps) are then **hand-shaped** into a
`Project` entry in `src/data/projects.ts`. The tool gets you the assets + 80% of the
content; a human writes the editorial framing.

Public data only. Notion pages must be publicly shared; private pages return nothing.

## `step-to-glb.mjs`

Converts a CAD `STEP`/`STP` file into a web-ready, Draco-compressed `GLB` for
`<model-viewer>`.

```bash
node tools/step-to-glb.mjs input.step public/models/out.glb --deflection 0.4 --max-facets 140000
```

Pipeline: FreeCAD tessellates + decimates the solid, then `gltf-transform` welds and
Draco-compresses it (a 18 MB STEP becomes a ~0.5 MB GLB). Flags:

- `--deflection N` - mesh fineness (lower = finer/heavier). Default `0.2`.
- `--max-facets N` - decimate to at most N triangles. Default `180000`.
- `--no-draco` - skip compression (larger file, no decoder needed).

Requires **FreeCAD.app** (macOS). Override the binary with
`FREECADCMD=/path/to/freecadcmd`. Uses `npx` to fetch `obj2gltf` + `@gltf-transform/cli`
on first run.

## `extract-maker.html`

Zero-setup, single-file maker-profile extractor. Open it in any browser - no server,
no build. Paste a maker/product/GitHub URL and it derives a `makers.ts` block (and a
`campaigns.ts` block for shop pages) via a public CORS proxy.

The `/dev/extract-maker` dashboard page is the richer version (server-side fetch, no
proxy limits); this file is the portable fallback for when you're not running the app.
