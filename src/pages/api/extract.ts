/**
 * Server-side URL fetcher - avoids CORS proxy limitations.
 * Returns {html, status} for public URLs only.
 * No tokens, no private data.
 */
export const prerender = false;

import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  let url: string;
  try {
    const body = await request.json();
    url = String(body?.url ?? "").trim();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!url) return json({ error: "url is required" }, 400);

  // Only allow http/https
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: "Invalid URL" }, 400);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return json({ error: "Only http/https URLs are allowed" }, 400);
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ooru-dev-tools/1.0 (+https://ooru.build)" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    return json({ html, status: res.status, finalUrl: res.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: "Fetch failed: " + msg }, 502);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
