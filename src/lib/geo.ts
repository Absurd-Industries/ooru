/**
 * Lightweight visitor geolocation. Uses a free, no-key IP API (ipwho.is)
 * once per visitor, caches the result in the local guest store, and is
 * SSR-safe (returns null on the server). No browser permission prompt.
 *
 * Callers should always have a graceful fallback (e.g. "Bengaluru, India"
 * or "Online") for when detection fails or is blocked.
 */
import { getPref, setPref } from "./store";

export interface Geo {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  fetchedAt: number;
}

const CACHE_KEY = "geo";
const TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

/** Synchronously return a fresh-enough cached geo, or null. */
export function cachedGeo(): Geo | null {
  const g = getPref<Geo | null>(CACHE_KEY, null);
  if (g && typeof g.fetchedAt === "number" && Date.now() - g.fetchedAt < TTL) {
    return g;
  }
  return null;
}

/** Detect + cache the visitor's geo. Resolves to null if unavailable. */
export async function getGeo(): Promise<Geo | null> {
  if (typeof window === "undefined") return null;
  const cached = cachedGeo();
  if (cached) return cached;
  try {
    const res = await fetch(
      "https://ipwho.is/?fields=city,region,country,country_code,success",
      { signal: AbortSignal.timeout?.(4000) }
    );
    const j: any = await res.json();
    if (j && j.success !== false) {
      const geo: Geo = {
        city: j.city ?? null,
        region: j.region ?? null,
        country: j.country ?? null,
        countryCode: j.country_code ?? null,
        fetchedAt: Date.now(),
      };
      setPref(CACHE_KEY, geo);
      return geo;
    }
  } catch {
    /* network / timeout / blocked - caller falls back */
  }
  return null;
}

/** "City, Country" (or the best available part), or null. */
export function formatGeo(g: Geo | null): string | null {
  if (!g) return null;
  if (g.city && g.country) return `${g.city}, ${g.country}`;
  return g.country ?? g.city ?? null;
}
