<script setup lang="ts">
/**
 * CoryDoraOpening - owns the cold-open → story handoff.
 *
 *   intro      : only the field is mounted (one WebGL context). Flyby + "Enter".
 *   transition : "Enter" picks a random unit; we mount the story underneath and feed
 *                it that unit's colourway while the field flies into the same unit.
 *   story      : once the field's zoom finishes AND the story is ready, the field
 *                fades out and unmounts for good - leaving just the one you chose.
 *
 * A shared-build URL (?body=…&trim=…) skips the intro and deep-links straight in.
 */
import { ref } from "vue";
import CoryDoraField from "./CoryDoraField.vue";
import CoryDoraExperience from "./CoryDoraExperience.vue";
import { PARTS } from "../../data/corydora-parts";
import type { CampaignTier, LandingScene, ProjectFile, ProjectSpec } from "../../types";

const props = defineProps<{
  src: string;
  alt?: string;
  dimensions?: { w: number; d: number; h: number };
  campaignSlug: string;
  tiers: CampaignTier[];
  journey: LandingScene[];
  customizeCamMobile?: { pos: [number, number, number]; target: [number, number, number] };
  files?: ProjectFile[];
  specs?: ProjectSpec[];
  license?: string;
}>();

// deep-link to a shared build → skip the cold open
const hasBuild = typeof location !== "undefined" && PARTS.some((p) => new URLSearchParams(location.search).get(p.id));

const phase = ref<"intro" | "transition" | "story">(hasBuild ? "story" : "intro");
const introColors = ref<Record<string, string>>({});
const fieldFade = ref(false);
let fieldDone = false, storyReady = false;

function onStart(colors: Record<string, string>) {
  introColors.value = colors;       // story mounts underneath + adopts this colourway
  phase.value = "transition";
}
function onZoomDone() { fieldDone = true; maybeFinish(); }
function onStoryReady() { storyReady = true; maybeFinish(); }
function maybeFinish() {
  if (!fieldDone || !storyReady) return;    // wait until the story is actually framed
  fieldFade.value = true;                   // cross-fade the field out…
  setTimeout(() => { phase.value = "story"; }, 750); // …then drop it (and the rest) forever
}
</script>

<template>
  <div class="cdo">
    <CoryDoraExperience
      v-if="phase !== 'intro'"
      v-bind="props"
      :introColors="introColors"
      @ready="onStoryReady"
    />
    <div v-if="phase !== 'story'" class="cdo-field" :class="{ faded: fieldFade }">
      <CoryDoraField :src="src" @start="onStart" @done="onZoomDone" />
    </div>
  </div>
</template>

<style scoped>
.cdo { position: relative; min-height: 100svh; }
.cdo-field { position: fixed; inset: 0; z-index: 50; transition: opacity 0.75s ease; }
.cdo-field.faded { opacity: 0; }
</style>
