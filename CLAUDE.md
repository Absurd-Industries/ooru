# Absurd Industries - Project Map

Open-source STEAM community platform built with Astro, Vue 3, and Tailwind CSS, deployed on Cloudflare Pages.

## Architecture

```
src/
├── layouts/BaseLayout.astro    ← Every page wraps in this (head, fonts, logo, footer, bottom bar)
├── components/                 ← Astro (static) and Vue (interactive) components
├── pages/                      ← File-based routing, [slug].astro for dynamic routes
├── data/                       ← Typed mock data arrays (future D1 API drop-in)
├── styles/global.css           ← Shared CSS (cards, buttons, tags, nav, animations)
└── types/index.ts              ← All TypeScript interfaces
```

## Tech Stack

- **Astro 6** - static-first with per-page SSR opt-in
- **Vue 3** - interactive islands via `@astrojs/vue` (Composition API, `<script setup>`)
- **Tailwind CSS 3** - utility classes, single config in `tailwind.config.mjs`
- **Cloudflare Pages** - hosting via `@astrojs/cloudflare` adapter
- **pnpm** - package manager

## Design System

Colors (defined in `tailwind.config.mjs`):
- `kraft` (#D4B896) - background, paper texture
- `ink` (#1A1A1A) - primary text
- `stamp` (#FF5900) - accent, CTAs
- `paper` (#FAF3E8) - card backgrounds
- `funded` (#2A5F41) - success/funded state
- `stencil` (#6B5B4A) - secondary text

Fonts: Fraunces (serif headings) + DM Sans (sans body)
Icons: Phosphor Icons (bold weight) + FontAwesome (brand icons)
Cards: SVG feTurbulence displacement filters for organic paper-cut edges

## Key Patterns

### Adding a new page
1. Create `src/pages/your-page.astro` (or `src/pages/section/index.astro`)
2. Import and wrap with `<BaseLayout title="Page Title" activeTab="section">`
3. Use existing components: `Card`, `Tag`, `ProgressBar`
4. For interactive parts, create a `.vue` file and use `client:load` or `client:visible`

### Adding a new data type
1. Add the interface to `src/types/index.ts`
2. Create `src/data/your-type.ts` with a typed array export
3. Shape it like a future API response (the array will later be replaced by a D1 query)

### Static vs Vue island decision
- **Static (Astro):** Anything that doesn't need client-side JS - cards, layouts, tags, footers
- **Vue island:** Anything with user interaction - search, filters, modals, toggles, forms
- Default to `client:visible` (lazy). Use `client:load` only for above-fold interactive elements

### Component conventions
- One component per file, flat naming: `CampaignCard.astro`, not `cards/Campaign.astro`
- Props interface at the top with JSDoc on non-obvious fields
- Astro components: destructure `Astro.props` in frontmatter
- Vue components: `<script setup lang="ts">` with `defineProps<{...}>()`

## Commands

```bash
pnpm dev        # Start dev server (localhost:4321)
pnpm build      # Build for production
pnpm preview    # Preview production build locally
pnpm check      # TypeScript checking
```

## Content Data

All mock data lives in `src/data/*.ts` as typed arrays. Each file exports a const array
shaped like what a future Cloudflare D1 API would return. When the API is built, swap the
import for a fetch call - the types stay the same.

- `campaigns.ts` - campaign listings (INR only); `richLayout: true` swaps in the bespoke page
- `projects.ts` - project folios (specs, BOM, files, build/onboarding guides, model)
- `makers.ts` - maker profiles (incl. `timeline`)
- `corydora-landing.ts` - CoryDora flagship content (hero, journey scenes, tiers)
- `corydora-parts.ts` - 3D customizer parts + swatch options
- `events.ts` - Bengaluru-first STEAM events
- `requests.ts` - community requests
- `friends.ts` - partner logos for "Friends of Absurd"
- `navigation.ts` - bottom bar tabs and mega menu items

## CoryDora Visualizer (flagship 3D campaign)

`/balub/corydora` is a bespoke immersive 3D experience and the template for "rich" campaigns
going forward. Because Astro islands are isolated, the whole interactive surface is **one Vue
island** that embeds the viewer and drives it through `defineExpose`:

- `components/ModelExperience.vue` - the Three.js viewer (GLTF+Draco, OrbitControls, HDR env,
  bloom, AgX tone-map). Generic + reusable; exposes an API, holds no CoryDora specifics.
- `components/corydora/CoryDoraExperience.vue` - the single island: embeds `<ModelExperience ref>`
  and runs the scroll tour, the live colour customizer, and the reserve/share/cart flow.
- `components/corydora/CoryDoraLanding.astro` - puts the island in `GenericCampaign`'s
  `<slot name="top">`; below it is the standard campaign body fed CoryDora data.

**Routing:** `Campaign.richLayout` makes `[maker]/[campaign].astro` render `CoryDoraLanding`
instead of `GenericCampaign`.

**Viewer API (`defineExpose`):** `ready`, `frameTo(cam, parts)`, `setMode(label)`,
`isolate(parts)`, `setPartColor`/`getConfig`, `setStoryFloor(opts)`, `setFloorLogo`, `setDims`,
`setOled(program)`, `flashPart`, `enterTour`/`enterCustomize`, `toggleDebug`.

**Journey scene** (`LandingScene` in `corydora-landing.ts`): `{ id, eyebrow?, script?, bigType?,
title, body, mode?, oled?, isolate?, cam, camMobile?, panelMobile?, files?, spec? }`. Advancing a
chapter reframes the camera, ghosts non-isolated parts, switches render `mode`, drives the OLED,
and prints editorial copy on the floor via `setStoryFloor`.

**Mobile:** scenes carry phone-specific `camMobile` + `panelMobile`, applied below 720px; stage is
`90svh` on phones.

**OLED:** a simulated 128x32 emissive plane; `setOled(program)` switches screens (`hello`, `boot`,
`swap`, `case`, `via`). On the VIA chapter the encoder glows until clicked; a click cycles 4 layers
and shows a floor "layer map".

**`?debug`:** opens a live tuner - drag the model for a camera frame, nudge floor/logo/OLED/map
positions, toggle Phone/Desktop, then **Copy frame** / **Copy tune** to paste values back into the
scene data or the constants at the top of `ModelExperience.vue` (`STORY_PANEL_OFFSET`, `LOGO_POS`/
`LOGO_LONG`, `OLED_POS`/`OLED_SIZE`/`OLED_ROT`, `MAP_OFFSET`/`MAP_H`).

## Deployment

Cloudflare Pages with `@astrojs/cloudflare` adapter. All pages prerender by default (static).
Pages that need server-side rendering add `export const prerender = false` in frontmatter.

## Legacy Pages

Unchanged legacy sub-sites live in `public/` and are served as static files:
- `public/hardware-devroom/` - Hardware Devroom event site
- `public/amartha/` - Amartha sub-project
- `public/quotes/` - RFQ management tool

Reference HTML from the pre-Astro site is in `_reference/` for visual comparison.
