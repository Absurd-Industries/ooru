<script setup lang="ts">
/**
 * Hero eyebrow that localizes to the visitor's area (IP-based, no prompt).
 * Falls back to the provided default ("Bengaluru, India") on the server or
 * when detection fails. Reads/writes the cached geo via the guest store.
 */
import { ref, onMounted } from "vue";
import { getGeo, formatGeo, cachedGeo } from "../lib/geo";

const props = defineProps<{ fallback?: string }>();
const fallback = props.fallback || "Bengaluru, India";
const text = ref(formatGeo(cachedGeo()) || fallback);

onMounted(async () => {
  const f = formatGeo(await getGeo());
  if (f) text.value = f;
});
</script>

<template>
  <p class="text-sm font-semibold uppercase tracking-widest text-stencil mb-4">
    {{ text }}
  </p>
</template>
