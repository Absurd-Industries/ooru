<script setup lang="ts">
/**
 * Cheer - a lightweight public appreciation for a maker (kudos).
 * Backed by the store's reactions table (target_type 'maker'). Unlike
 * "follow" it needs no feed to be meaningful today: it's a one-tap
 * thank-you with a visible count.
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import { hasReacted, toggleReaction, reactionCount, onChange } from "../lib/store";

const props = defineProps<{ makerId: string; baseCount?: number }>();

const tick = ref(0);
let unsub: () => void = () => {};
onMounted(() => {
  unsub = onChange(() => tick.value++);
});
onUnmounted(() => unsub());

const cheered = computed(() => {
  tick.value;
  return hasReacted("maker", props.makerId);
});
const count = computed(() => {
  tick.value;
  return (props.baseCount || 0) + reactionCount("maker", props.makerId);
});
function toggle() {
  toggleReaction("maker", props.makerId);
}
</script>

<template>
  <button class="cheer-btn" :class="{ 'cheer-btn--on': cheered }" @click="toggle">
    <i :class="cheered ? 'ph-fill ph-hands-clapping' : 'ph-bold ph-hands-clapping'"></i>
    <span>{{ cheered ? "Cheered" : "Cheer" }}</span>
    <span class="cheer-count">{{ count }}</span>
  </button>
</template>

<style scoped>
.cheer-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  border-radius: 0.5rem;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  border: 1.5px solid #1a1a1a;
  background: #1a1a1a;
  color: #faf3e8;
  transition: background 0.15s, color 0.15s, transform 0.15s, border-color 0.15s;
}
.cheer-btn:hover { transform: translateY(-1px); }
.cheer-btn i { font-size: 0.85rem; }
.cheer-btn--on {
  background: #ff5900;
  border-color: #ff5900;
  color: #faf3e8;
}
.cheer-count {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: rgba(250, 243, 232, 0.18);
}
</style>
