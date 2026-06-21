/**
 * Single source of truth for the site map.
 *
 * Both outputs derive from `getSitemapEntries()` so they can never drift:
 *   - `src/pages/sitemap.xml.ts`  → machine-readable /sitemap.xml (for crawlers)
 *   - `src/pages/sitemap.astro`   → human-readable /sitemap (links to the XML)
 *
 * The map expands automatically as the site grows: data-driven sections pull
 * straight from `src/data/*`, so a new campaign/maker/request shows up in both
 * outputs with no extra work. To add a new *static* route, append it to
 * STATIC_PAGES; to add a new data-driven section, add a block in
 * getSitemapEntries().
 */
import { campaigns } from "../data/campaigns";
import { makers } from "../data/makers";
import { requests } from "../data/requests";
import { projects } from "../data/projects";

export type ChangeFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface SitemapEntry {
  /** Root-relative path, e.g. "/campaigns/lampy-open-source-desk-lamp". */
  path: string;
  /** Human-readable label for the /sitemap page. */
  label: string;
  /** Grouping heading on the /sitemap page. */
  section: string;
  changefreq: ChangeFreq;
  /** 0.0 – 1.0 */
  priority: number;
}

/** Fixed, hand-curated routes. Add new top-level pages here. */
const STATIC_PAGES: SitemapEntry[] = [
  { path: "/", label: "Home", section: "Main pages", changefreq: "daily", priority: 1.0 },
  { path: "/campaigns", label: "Campaigns", section: "Main pages", changefreq: "daily", priority: 0.9 },
  { path: "/projects", label: "Projects", section: "Main pages", changefreq: "weekly", priority: 0.8 },
  { path: "/requests", label: "Requests", section: "Main pages", changefreq: "daily", priority: 0.8 },
  { path: "/makers", label: "Makers", section: "Main pages", changefreq: "weekly", priority: 0.8 },
  { path: "/events", label: "Events", section: "Main pages", changefreq: "weekly", priority: 0.8 },
  { path: "/faq", label: "FAQ", section: "Main pages", changefreq: "monthly", priority: 0.5 },
  { path: "/contact", label: "Contact", section: "Main pages", changefreq: "monthly", priority: 0.4 },
  { path: "/sitemap", label: "Sitemap", section: "Main pages", changefreq: "weekly", priority: 0.2 },
];

/** Every indexable URL — static routes plus all data-driven detail pages. */
export function getSitemapEntries(): SitemapEntry[] {
  return [
    ...STATIC_PAGES,
    ...campaigns.map((c): SitemapEntry => ({
      path: `/campaigns/${c.slug}`,
      label: c.title,
      section: "Campaigns",
      changefreq: "weekly",
      priority: 0.7,
    })),
    ...projects.map((p): SitemapEntry => ({
      path: `/projects/${p.slug}`,
      label: p.title,
      section: "Projects",
      changefreq: "weekly",
      priority: 0.7,
    })),
    ...makers.map((m): SitemapEntry => ({
      path: `/makers/${m.slug}`,
      label: m.name,
      section: "Makers",
      changefreq: "weekly",
      priority: 0.6,
    })),
    ...requests.map((r): SitemapEntry => ({
      path: `/requests/${r.slug}`,
      label: r.title,
      section: "Requests",
      changefreq: "weekly",
      priority: 0.6,
    })),
  ];
}

/** Entries grouped by section, preserving first-seen order (for the /sitemap page). */
export function getSitemapSections(): { section: string; items: SitemapEntry[] }[] {
  const order: string[] = [];
  const map = new Map<string, SitemapEntry[]>();
  for (const e of getSitemapEntries()) {
    if (!map.has(e.section)) {
      map.set(e.section, []);
      order.push(e.section);
    }
    map.get(e.section)!.push(e);
  }
  return order.map((section) => ({ section, items: map.get(section)! }));
}

export const FALLBACK_SITE = "https://ooru.build";

/** Absolute URL from a root-relative path + the build's configured `site`. */
export function absoluteUrl(path: string, site?: URL | string): string {
  const base = (site ? new URL(site).href : FALLBACK_SITE).replace(/\/$/, "");
  return base + path;
}
