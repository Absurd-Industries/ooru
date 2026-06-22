<script setup lang="ts">
/**
 * Always-visible bottom navigation bar with mega menu.
 * Vue island - needed for the mega menu toggle interaction.
 * Hydrated with client:load since it's always visible.
 *
 * Primary tabs never change - Flutter-style persistent bottom nav.
 * Hides on scroll down, reappears on scroll up.
 */

import { ref, onMounted, onUnmounted } from "vue";
import { bottomBarTabs, megaMenuItems } from "../data/navigation";
import { t } from "../lib/i18n-client";

const props = defineProps<{
    activeTab?: string;
}>();

// Map nav hrefs to i18n keys; brand items (Discord) fall back to their label.
const NAV_KEYS: Record<string, string> = {
    "/": "nav.home",
    "/events": "nav.events",
    "/campaigns": "nav.campaigns",
    "/makers": "nav.makers",
    "/requests": "nav.requests",
    "/faq": "nav.faq",
    "/contact": "nav.contact",
};
function navLabel(item: { href: string; label: string }): string {
    const k = NAV_KEYS[item.href];
    return k ? t(k) : item.label;
}

const megaMenuOpen = ref(false);
const hidden = ref(false);

let lastScrollY = 0;
let ticking = false;

function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > lastScrollY && y > 80) {
            hidden.value = true;
            megaMenuOpen.value = false;
        } else {
            hidden.value = false;
        }
        lastScrollY = y;
        ticking = false;
    });
}

function closeMegaMenu() {
    megaMenuOpen.value = false;
}

function onClickOutside(e: MouseEvent) {
    if (!megaMenuOpen.value) return;
    const nav = (e.target as HTMLElement).closest(".bottom-bar");
    if (!nav) {
        megaMenuOpen.value = false;
    }
}

onMounted(() => {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClickOutside);
});

onUnmounted(() => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClickOutside);
});
</script>

<template>
    <nav :class="['bottom-bar', { 'bottom-bar--hidden': hidden }]">
        <div class="grid grid-cols-5">
            <a
                v-for="tab in bottomBarTabs"
                :key="tab.href"
                :href="tab.href"
                :class="{
                    'active-tab':
                        tab.href === '/'
                            ? !activeTab
                            : activeTab === tab.href.replace('/', ''),
                }"
            >
                <i :class="tab.icon"></i>
                <span>{{ navLabel(tab) }}</span>
            </a>
            <button @click="megaMenuOpen = !megaMenuOpen">
                <i
                    :class="
                        megaMenuOpen ? 'ph-bold ph-x' : 'ph-bold ph-dots-three'
                    "
                ></i>
                <span>{{ t("nav.more") }}</span>
            </button>
        </div>

        <Transition name="slide">
            <div v-if="megaMenuOpen" class="mega-menu-wrapper">
                <div class="mega-menu" @click.stop>
                    <a
                        v-for="item in megaMenuItems"
                        :key="item.href"
                        :href="item.href"
                        :target="item.isExternal ? '_blank' : undefined"
                        :rel="item.isExternal ? 'noopener' : undefined"
                        @click="closeMegaMenu"
                    >
                        <i :class="item.icon"></i>
                        {{ navLabel(item) }}
                    </a>
                </div>
            </div>
        </Transition>
    </nav>
</template>
