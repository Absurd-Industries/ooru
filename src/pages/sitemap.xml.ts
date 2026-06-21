/**
 * Machine-readable sitemap at /sitemap.xml (referenced by public/robots.txt).
 * Prerendered to a static file at build time and regenerated from the shared
 * source (src/lib/sitemap.ts) every build, so it grows with the data. The
 * human-readable /sitemap page reads from the same source.
 */
import type { APIRoute } from "astro";
import { getSitemapEntries, absoluteUrl } from "../lib/sitemap";

export const prerender = true;

const escapeXml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const GET: APIRoute = ({ site }) => {
  const urls = getSitemapEntries()
    .map(
      (e) => `  <url>
    <loc>${escapeXml(absoluteUrl(e.path, site))}</loc>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
