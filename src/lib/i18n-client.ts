/**
 * Client-side i18n glue for Vue islands + the language switcher.
 * - `locale` is a reactive ref; each island gets its own copy but they stay
 *   in sync through the "ooru:locale" window event.
 * - `t()` is the reactive translator for templates.
 * - `setLocale()` flips the language everywhere: islands (event), static
 *   Astro DOM (applyStatic), and the logo wordmark (<html lang> + CSS).
 */
import { ref } from "vue";
import { dicts, LOCALE_KEY, t as translate, isLocale, type Locale } from "../i18n";

function readLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(LOCALE_KEY);
    return isLocale(v) ? v : "en";
  } catch {
    return "en";
  }
}

export const locale = ref<Locale>(readLocale());

// Keep every island's copy of this ref in sync when the locale changes.
if (typeof window !== "undefined") {
  window.addEventListener("ooru:locale", (e: Event) => {
    const l = (e as CustomEvent).detail;
    if (isLocale(l)) locale.value = l;
  });
}

/** Reactive translate for Vue templates. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(key, locale.value, vars);
}

/** Re-apply translations to the static (Astro-rendered) DOM after a switch. */
export function applyStatic(l: Locale): void {
  if (typeof document === "undefined") return;
  const d = dicts[l] || {};
  const enD = dicts.en;
  const pick = (k: string) => (d[k] != null ? d[k] : enD[k]);
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (!k) return;
    const v = pick(k);
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-attr]").forEach((el) => {
    const spec = el.getAttribute("data-i18n-attr");
    if (!spec) return;
    spec.split(";").forEach((pair) => {
      const i = pair.indexOf(":");
      if (i < 0) return;
      const attr = pair.slice(0, i).trim();
      const k = pair.slice(i + 1).trim();
      const v = pick(k);
      if (v != null) el.setAttribute(attr, v);
    });
  });
}

/** Switch the active locale everywhere (islands + static DOM + logo). */
export function setLocale(l: Locale): void {
  if (!isLocale(l)) return;
  locale.value = l;
  try {
    window.localStorage.setItem(LOCALE_KEY, l);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = l; // drives the wordmark CSS swap
    applyStatic(l);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ooru:locale", { detail: l }));
  }
}
