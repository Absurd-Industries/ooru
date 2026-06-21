<script setup lang="ts">
/**
 * Language switcher (English / ಕನ್ನಡ / తెలుగు). Writes the choice via
 * setLocale(), which persists it and flips the whole UI - islands, static
 * DOM, and the logo wordmark. `variant="block"` renders a full-width row for
 * the footer / mobile; default is the compact top-bar pill.
 */
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { LOCALES, type Locale } from "../i18n";
import { locale, setLocale } from "../lib/i18n-client";

withDefaults(defineProps<{ variant?: "bar" | "block" }>(), { variant: "bar" });

const open = ref(false);
const current = computed(
  () => LOCALES.find((l) => l.code === locale.value) ?? LOCALES[0]
);

function choose(l: Locale) {
  setLocale(l);
  open.value = false;
}
function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null;
  if (!t?.closest?.(".lang-switch")) open.value = false;
}
onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));
</script>

<template>
  <div class="lang-switch" :class="{ 'is-block': variant === 'block' }">
    <button
      class="lang-btn"
      @click.stop="open = !open"
      :aria-expanded="open"
      aria-label="Language"
    >
      <i class="ph-bold ph-translate"></i>
      <span class="lang-cur">{{ current.native }}</span>
      <i class="ph-bold ph-caret-down lang-caret" :class="{ up: open }"></i>
    </button>
    <Transition name="lang-pop">
      <ul v-if="open" class="lang-menu" role="listbox">
        <li v-for="l in LOCALES" :key="l.code">
          <button
            class="lang-opt"
            :class="{ active: l.code === locale }"
            role="option"
            :aria-selected="l.code === locale"
            @click.stop="choose(l.code)"
          >
            <span class="lang-native">{{ l.native }}</span>
            <span class="lang-en">{{ l.label }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.lang-switch {
  position: relative;
  flex-shrink: 0;
}
.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(26, 26, 26, 0.14);
  border-radius: 999px;
  background: transparent;
  color: #1a1a1a;
  font-family: "DM Sans", system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;
}
.lang-btn:hover {
  color: #ff5900;
  border-color: rgba(255, 89, 0, 0.4);
}
.lang-caret {
  font-size: 0.6rem;
  transition: transform 0.18s ease;
}
.lang-caret.up {
  transform: rotate(180deg);
}
.lang-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  margin: 0;
  padding: 0.3rem;
  list-style: none;
  min-width: 9.5rem;
  background: #faf3e8;
  border: 1px solid rgba(26, 26, 26, 0.1);
  border-radius: 0.7rem;
  box-shadow: 0 10px 30px rgba(26, 26, 26, 0.18);
  z-index: 60;
}
.lang-opt {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: #1a1a1a;
  font-family: "DM Sans", system-ui, sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.lang-opt:hover {
  background: rgba(212, 184, 150, 0.4);
}
.lang-opt.active {
  color: #ff5900;
}
.lang-en {
  font-size: 0.72rem;
  font-weight: 500;
  color: #6b5b4a;
}
.lang-opt.active .lang-en {
  color: #ff5900;
}

/* Block variant (footer / mobile) */
.lang-switch.is-block .lang-btn {
  width: 100%;
  justify-content: center;
}
.lang-switch.is-block .lang-menu {
  left: 0;
  right: auto;
  width: 100%;
}

.lang-pop-enter-active,
.lang-pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.lang-pop-enter-from,
.lang-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Dark surfaces (footer is dark? no - but topnav dark pages) */
:global(html.dark) .lang-btn {
  color: #faf3e8;
  border-color: rgba(250, 243, 232, 0.2);
}
</style>
