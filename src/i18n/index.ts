/**
 * i18n core. Client-side, English-default UI translations.
 * - `t(key, locale, vars)` resolves a string with `{var}` interpolation and
 *   falls back: requested locale → English → the raw key.
 * - Usable at build time (Astro, default locale "en") and on the client.
 * See README "Localization" for the maintenance rule.
 */
import { en } from "./en";
import { kn } from "./kn";
import { te } from "./te";

export type Locale = "en" | "kn" | "te";

export const LOCALE_KEY = "ooru.locale";

export const LOCALES: { code: Locale; native: string; label: string }[] = [
  { code: "en", native: "English", label: "English" },
  { code: "kn", native: "ಕನ್ನಡ", label: "Kannada" },
  { code: "te", native: "తెలుగు", label: "Telugu" },
];

export const dicts: Record<Locale, Record<string, string>> = { en, kn, te };

/** Locale-aware brand wordmark text (the logo). */
export const WORDMARK: Record<Locale, string> = {
  en: "ooru.build",
  kn: "ಊರು",
  te: "ఊరు",
};

export function isLocale(x: unknown): x is Locale {
  return x === "en" || x === "kn" || x === "te";
}

export function t(
  key: string,
  locale: Locale = "en",
  vars?: Record<string, string | number>
): string {
  const d = dicts[locale] || en;
  let s = d[key] ?? en[key] ?? key;
  if (vars) {
    for (const k in vars) s = s.split("{" + k + "}").join(String(vars[k]));
  }
  return s;
}
