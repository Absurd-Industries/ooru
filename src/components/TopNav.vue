<script setup lang="ts">
/**
 * Site-wide top navigation bar.
 * A normal sticky header: logo on the left, links on the right.
 * Collapses to a hamburger menu on mobile. Replaces the old floating
 * DesktopNav + bottom BottomBar.
 */

import { ref } from "vue";

const props = defineProps<{
  activeTab?: string;
}>();

const links = [
  { label: "Campaigns", href: "/campaigns" },
  { label: "Makers", href: "/makers" },
  { label: "Requests", href: "/requests" },
  { label: "Events", href: "/events" },
  { label: "Hardware Devroom", href: "/hardware-devroom" },
  { label: "FAQ", href: "/faq" },
];

const open = ref(false);

function isActive(href: string): boolean {
  return props.activeTab === href.replace(/\//g, "");
}
</script>

<template>
  <header class="topnav">
    <div class="topnav-inner">
      <a href="/" class="topnav-logo" aria-label="Ooru home">
        <img src="/images/ooru-logo.svg" alt="Ooru" width="74" height="40" />
      </a>

      <!-- Desktop links -->
      <nav class="topnav-links" aria-label="Primary">
        <a
          v-for="l in links"
          :key="l.href"
          :href="l.href"
          class="topnav-link"
          :class="{ active: isActive(l.href) }"
        >{{ l.label }}</a>
        <a
          href="https://discord.gg/DUSUtguG2H"
          target="_blank"
          rel="noopener"
          class="topnav-discord"
        >
          <i class="ph-bold ph-discord-logo"></i>
          <span>Discord</span>
        </a>
      </nav>

      <!-- Mobile toggle -->
      <button
        class="topnav-burger"
        @click="open = !open"
        :aria-expanded="open"
        aria-label="Toggle menu"
      >
        <i :class="open ? 'ph-bold ph-x' : 'ph-bold ph-list'"></i>
      </button>
    </div>

    <!-- Mobile menu -->
    <Transition name="topnav-drop">
      <nav v-if="open" class="topnav-mobile" aria-label="Primary mobile">
        <a
          v-for="l in links"
          :key="l.href"
          :href="l.href"
          class="topnav-mobile-link"
          :class="{ active: isActive(l.href) }"
          @click="open = false"
        >{{ l.label }}</a>
        <a href="/contact" class="topnav-mobile-link" @click="open = false">Contact</a>
        <a
          href="https://discord.gg/DUSUtguG2H"
          target="_blank"
          rel="noopener"
          class="topnav-mobile-link discord"
          @click="open = false"
        >
          <i class="ph-bold ph-discord-logo"></i> Discord
        </a>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.topnav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(212, 184, 150, 0.88);
  backdrop-filter: saturate(1.2) blur(8px);
  -webkit-backdrop-filter: saturate(1.2) blur(8px);
  border-bottom: 1px solid rgba(26, 26, 26, 0.08);
}
.topnav-inner {
  max-width: 72rem;
  margin: 0 auto;
  padding: 0.5rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.topnav-logo {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.topnav-logo img {
  height: 2.25rem;
  width: auto;
}

/* Desktop links */
.topnav-links {
  display: none;
  align-items: center;
  gap: 0.35rem;
}
.topnav-link {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1a1a1a;
  text-decoration: none;
  padding: 0.4rem 0.7rem;
  border-radius: 0.5rem;
  white-space: nowrap;
  transition: color 0.15s, background 0.15s;
}
.topnav-link:hover {
  color: #ff5900;
  background: rgba(250, 243, 232, 0.6);
}
.topnav-link.active {
  color: #ff5900;
}

.topnav-discord {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: 0.5rem;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  background: #1a1a1a;
  color: #faf3e8;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, transform 0.15s;
}
.topnav-discord:hover {
  background: #ff5900;
  transform: translateY(-1px);
}

/* Mobile burger */
.topnav-burger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: transparent;
  color: #1a1a1a;
  font-size: 1.5rem;
  cursor: pointer;
  border-radius: 0.5rem;
}
.topnav-burger:hover {
  color: #ff5900;
}

/* Mobile menu */
.topnav-mobile {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem 0.75rem;
  border-top: 1px solid rgba(26, 26, 26, 0.06);
  background: rgba(212, 184, 150, 0.96);
}
.topnav-mobile-link {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a1a;
  text-decoration: none;
  padding: 0.7rem 0.75rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.topnav-mobile-link:hover,
.topnav-mobile-link.active {
  color: #ff5900;
  background: rgba(250, 243, 232, 0.6);
}
.topnav-mobile-link.discord {
  margin-top: 0.25rem;
  background: #1a1a1a;
  color: #faf3e8;
  justify-content: center;
}
.topnav-mobile-link.discord:hover {
  background: #ff5900;
}

.topnav-drop-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.topnav-drop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.topnav-drop-enter-from,
.topnav-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Desktop breakpoint */
@media (min-width: 1024px) {
  .topnav-links {
    display: flex;
  }
  .topnav-burger {
    display: none;
  }
}

/* Dark-mode pages */
:global(html.dark) .topnav {
  background: rgba(26, 26, 26, 0.85);
  border-bottom-color: rgba(250, 243, 232, 0.1);
}
:global(html.dark) .topnav-link,
:global(html.dark) .topnav-burger {
  color: #faf3e8;
}
:global(html.dark) .topnav-mobile {
  background: rgba(26, 26, 26, 0.97);
}
:global(html.dark) .topnav-mobile-link {
  color: #faf3e8;
}
</style>
