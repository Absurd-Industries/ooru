<script setup lang="ts">
/**
 * "Reset my data" - lets a guest wipe their 100%-local session (the burst,
 * on demand). Everything lives in localStorage, so this is a clean reset.
 */
import { resetGuest } from "../lib/store";
import { t } from "../lib/i18n-client";

function reset() {
  if (typeof window === "undefined") return;
  if (window.confirm(t("footer.resetConfirm"))) {
    resetGuest();
    window.location.reload();
  }
}
</script>

<template>
  <button class="reset-data" type="button" @click="reset">
    <i class="ph-bold ph-arrow-counter-clockwise"></i>
    <span>{{ t("footer.reset") }}</span>
  </button>
</template>

<style scoped>
.reset-data {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: "DM Sans", system-ui, sans-serif;
  font-size: 0.72rem;
  font-weight: 500;
  color: #6b5b4a;
  padding: 0.2rem 0.3rem;
  transition: color 0.15s;
}
.reset-data:hover {
  color: #d94800;
}
.reset-data i {
  font-size: 0.8rem;
}
</style>
