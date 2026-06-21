/**
 * Single source of truth for the site's URL scheme.
 *
 * Maker-centric: every maker owns a top-level namespace under their handle.
 *
 *   /                         home
 *   /:maker                   maker profile
 *   /:maker/projects          that maker's projects
 *   /:maker/campaigns         that maker's campaigns
 *   /:maker/project/:project  a project folio
 *   /:maker/:campaign         a campaign (no "campaign" segment - lives under the maker)
 *   /makers                   all makers
 *   /campaigns                all campaigns
 *   /projects                 all projects
 *   /requests                 community requests
 *
 * Because makers live at the top level, a maker handle must never collide with a
 * reserved top-level path. RESERVED_SLUGS lists them; assertMakerSlugs() fails the
 * build if a maker ever takes one.
 */
import { campaigns } from "../data/campaigns";
import { projects } from "../data/projects";

// ── Builders ──────────────────────────────────────────────────────────
export const makerUrl = (makerSlug: string): string => `/${makerSlug}`;
export const makerProjectsUrl = (makerSlug: string): string => `/${makerSlug}/projects`;
export const makerCampaignsUrl = (makerSlug: string): string => `/${makerSlug}/campaigns`;
export const campaignUrl = (makerSlug: string, campaignSlug: string): string =>
  `/${makerSlug}/${campaignSlug}`;
export const projectUrl = (makerSlug: string, projectSlug: string): string =>
  `/${makerSlug}/project/${projectSlug}`;

// ── Cross-maker listings ─────────────────────────────────────────────
export const MAKERS_URL = "/makers";
export const CAMPAIGNS_URL = "/campaigns";
export const PROJECTS_URL = "/projects";
export const REQUESTS_URL = "/requests";

// ── Slug-only lookups (when the maker isn't in scope at the link site) ──
export function campaignUrlBySlug(slug: string | undefined): string {
  if (!slug) return CAMPAIGNS_URL;
  const c = campaigns.find((c) => c.slug === slug);
  return c ? campaignUrl(c.makerSlug, c.slug) : CAMPAIGNS_URL;
}
export function projectUrlBySlug(slug: string | undefined): string {
  if (!slug) return PROJECTS_URL;
  const p = projects.find((p) => p.slug === slug);
  return p ? projectUrl(p.makerSlug, p.slug) : PROJECTS_URL;
}

// ── Reserved top-level paths a maker handle must not take ──────────────
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "makers", "campaigns", "projects", "requests", "events", "faq", "contact",
  "dev", "api", "debug", "sitemap", "sitemap.xml", "index",
  "images", "models", "og", "favicon", "robots.txt", "fonts", "partners", "graphics",
  // legacy static sub-sites served from public/
  "hardware-devroom", "amartha", "quotes",
]);

/** Build-time guard: throws if any maker handle collides with a reserved path. */
export function assertMakerSlugs(slugs: string[]): void {
  for (const s of slugs) {
    if (RESERVED_SLUGS.has(s)) {
      throw new Error(
        `Maker handle "${s}" collides with a reserved top-level path. ` +
          `Pick a different handle or add it to an allow-list.`
      );
    }
  }
}
