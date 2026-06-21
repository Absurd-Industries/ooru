<script setup lang="ts">
/**
 * ModelStage - a lit, grounded <model-viewer> for product folios.
 *
 * - Real studio HDR lighting (environment-image) + commerce tone mapping +
 *   soft contact shadow, so the model reads as a real object, not grey clay.
 * - A switchable "surface" behind the (transparent) viewer - studio sweep,
 *   kraft paper, a wooden desk, or a dark stage - to give it context.
 * - An optional dimension overlay (hotspots pinned to the mesh) for scale.
 */
import { ref, onMounted, computed } from "vue";

const props = defineProps<{
  src: string;
  alt: string;
  /** Real-world size in mm, for the scale overlay + hotspot placement. */
  dimensions?: { w: number; d: number; h: number };
}>();

type SurfaceId = "studio" | "kraft" | "desk" | "dark";
const surfaces: { id: SurfaceId; label: string; exposure: number; dark?: boolean }[] = [
  { id: "studio", label: "Studio", exposure: 1.1 },
  { id: "kraft", label: "Kraft", exposure: 1.15 },
  { id: "desk", label: "Desk", exposure: 1.05 },
  { id: "dark", label: "Dark", exposure: 1.35, dark: true },
];

const surface = ref<SurfaceId>("studio");
const showScale = ref(false);
const active = computed(() => surfaces.find((s) => s.id === surface.value)!);

// Hotspot positions from the bounding box (model centered in X/Z, resting near y=0).
const d = computed(() => props.dimensions ?? { w: 0, d: 0, h: 0 });
const pos = computed(() => ({
  width: `0 ${d.value.h} ${d.value.d / 2}`,
  depth: `${d.value.w / 2} 0 0`,
  height: `${-d.value.w / 2} ${d.value.h / 2} ${d.value.d / 2}`,
}));

onMounted(() => {
  if (!customElements.get("model-viewer")) {
    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js";
    document.head.appendChild(s);
  }
});
</script>

<template>
  <div class="ms-wrap">
    <div class="ms-stage" :class="`ms-stage--${surface}`">
      <model-viewer
        :src="src"
        :alt="alt"
        camera-controls
        auto-rotate
        auto-rotate-delay="3000"
        rotation-per-second="18deg"
        interaction-prompt="none"
        environment-image="/hdr/studio.hdr"
        tone-mapping="commerce"
        :exposure="active.exposure"
        shadow-intensity="1.2"
        shadow-softness="0.9"
        camera-orbit="35deg 68deg auto"
        min-camera-orbit="auto auto auto"
        max-camera-orbit="auto 95deg auto"
        class="ms-viewer"
      >
        <template v-if="showScale && dimensions">
          <button class="ms-dim" slot="hotspot-w" :data-position="pos.width" data-normal="0 1 0">
            {{ Math.round(dimensions.w) }} mm
          </button>
          <button class="ms-dim" slot="hotspot-d" :data-position="pos.depth" data-normal="1 0 0">
            {{ Math.round(dimensions.d) }} mm
          </button>
          <button class="ms-dim" slot="hotspot-h" :data-position="pos.height" data-normal="0 0 1">
            {{ Math.round(dimensions.h) }} mm
          </button>
        </template>
      </model-viewer>
    </div>

    <!-- Controls -->
    <div class="ms-controls">
      <div class="ms-surfaces">
        <button
          v-for="s in surfaces"
          :key="s.id"
          class="ms-surface-btn"
          :class="{ active: surface === s.id }"
          @click="surface = s.id"
        >
          <span class="ms-swatch" :class="`ms-swatch--${s.id}`"></span>
          {{ s.label }}
        </button>
      </div>
      <button
        v-if="dimensions"
        class="ms-scale-btn"
        :class="{ active: showScale }"
        @click="showScale = !showScale"
      >
        <i class="ph-bold ph-ruler"></i>
        Scale
      </button>
    </div>
    <p class="ms-hint">Drag to rotate · scroll to zoom · pick a surface for scale</p>
  </div>
</template>

<style scoped>
.ms-wrap { width: 100%; }

.ms-stage {
  position: relative;
  width: 100%;
  height: 420px;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: background 0.3s ease;
}
.ms-viewer {
  width: 100%;
  height: 100%;
  --poster-color: transparent;
  background: transparent;
}

/* Surfaces (the model-viewer is transparent over these) */
.ms-stage--studio {
  background:
    radial-gradient(ellipse 70% 55% at 50% 118%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%),
    linear-gradient(180deg, #f3eee4 0%, #e9e0d0 60%, #ddd0ba 100%);
}
.ms-stage--kraft {
  background-color: #cdb085;
  background-image:
    radial-gradient(ellipse 65% 50% at 50% 120%, rgba(0,0,0,0.18), rgba(0,0,0,0) 70%),
    url("/images/kraft-paper.jpg");
  background-size: cover, 420px;
}
.ms-stage--desk {
  background:
    radial-gradient(ellipse 70% 55% at 50% 120%, rgba(255,236,205,0.25), rgba(0,0,0,0) 65%),
    repeating-linear-gradient(92deg, rgba(0,0,0,0.05) 0 2px, rgba(255,255,255,0.03) 2px 5px),
    linear-gradient(180deg, #b9854f 0%, #9c6a3a 55%, #7c5028 100%);
}
.ms-stage--dark {
  background:
    radial-gradient(ellipse 65% 50% at 50% 120%, rgba(255,255,255,0.10), rgba(0,0,0,0) 65%),
    linear-gradient(180deg, #3a3a40 0%, #232327 55%, #161618 100%);
}

/* Dimension hotspots */
.ms-dim {
  background: rgba(26,26,26,0.85);
  color: #faf3e8;
  border: none;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: default;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  transform: translate(-50%, -50%);
}

/* Controls */
.ms-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}
.ms-surfaces { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.ms-surface-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  border-radius: 999px;
  border: 1.5px solid rgba(26,26,26,0.12);
  background: rgba(250,243,232,0.6);
  font-size: 0.72rem;
  font-weight: 600;
  color: #4a3d2f;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ms-surface-btn:hover { border-color: rgba(26,26,26,0.3); }
.ms-surface-btn.active { border-color: #d94800; background: rgba(217,72,0,0.06); color: #1a1a1a; }
.ms-swatch {
  width: 14px; height: 14px; border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.15);
  flex-shrink: 0;
}
.ms-swatch--studio { background: linear-gradient(135deg, #f3eee4, #ddd0ba); }
.ms-swatch--kraft { background: #cdb085 url("/images/kraft-paper.jpg"); background-size: cover; }
.ms-swatch--desk { background: linear-gradient(135deg, #b9854f, #7c5028); }
.ms-swatch--dark { background: linear-gradient(135deg, #3a3a40, #161618); }

.ms-scale-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1.5px solid rgba(26,26,26,0.12);
  background: rgba(250,243,232,0.6);
  font-size: 0.72rem;
  font-weight: 700;
  color: #4a3d2f;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ms-scale-btn:hover { border-color: rgba(26,26,26,0.3); }
.ms-scale-btn.active { border-color: #d94800; background: rgba(217,72,0,0.06); color: #d94800; }

.ms-hint { font-size: 0.72rem; color: #6b5b4a; margin-top: 0.5rem; }
</style>
