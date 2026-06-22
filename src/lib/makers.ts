/**
 * Maker lookups by slug - so cards that only carry a makerSlug (campaigns,
 * projects) can show the maker's real avatar + name without duplicating data.
 * Safe to import from both Astro components and Vue islands.
 */
import { makers } from "../data/makers";
import type { Maker } from "../types";

const bySlug: Record<string, Maker> = Object.fromEntries(
  makers.map((m) => [m.slug, m])
);

export const makerBySlug = (slug: string): Maker | undefined => bySlug[slug];
export const makerAvatar = (slug: string): string | undefined => bySlug[slug]?.avatar;
export const makerName = (slug: string, fallback?: string): string =>
  bySlug[slug]?.name ?? fallback ?? slug;
