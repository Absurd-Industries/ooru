<script setup lang="ts">
/**
 * On-page backing section. Reads the build the customizer saved to the local
 * store and shows it above the reserve flow, so "Back it" happens on the main
 * page rather than as an overlay inside the 3D viewer.
 */
import { ref, onMounted, onUnmounted } from "vue";
import CampaignRewards from "../CampaignRewards.vue";
import { getPref, onChange } from "../../lib/store";
import type { CampaignTier } from "../../types";

defineProps<{ tiers: CampaignTier[]; campaignSlug: string }>();

interface BuildPart { id: string; label: string; color: string; name: string }
const build = ref<BuildPart[]>([]);
let unsub = () => {};
const load = () => { build.value = getPref<BuildPart[]>("corydora.build", []); };
onMounted(() => { load(); unsub = onChange(load); });
onUnmounted(() => unsub());
</script>

<template>
  <div class="cb">
    <div v-if="build.length" class="cb-build">
      <span class="cb-label">Your build</span>
      <span v-for="p in build" :key="p.id" class="cb-chip">
        <span class="cb-dot" :style="{ background: p.color }"></span>
        {{ p.name }} {{ p.label.split(" ")[0].toLowerCase() }}
      </span>
    </div>
    <CampaignRewards :tiers="tiers" :campaignSlug="campaignSlug" />
  </div>
</template>

<style scoped>
.cb-build { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; padding: 0.75rem 1rem; background: #faf3e8; border: 1.5px solid rgba(26,26,26,0.1); border-radius: 0.8rem; }
.cb-label { font-weight: 800; color: #1a1a1a; font-size: 0.85rem; margin-right: 0.25rem; }
.cb-chip { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: #4a3d2f; }
.cb-dot { width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); }
</style>
