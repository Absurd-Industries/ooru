<script setup lang="ts">
/**
 * CoryDora rich experience - one island so the 2D UI drives the 3D directly.
 * The render is the permanent stage; content composites over it in two looks:
 *   - Tour (dark editorial): the model is the canvas, type/spec/files float in
 *     the negative space, each chapter animates the camera / isolation / mode.
 *   - Customise (light tool): the model gets boxed, editorial collapses, and
 *     floating swatch tiles (desktop) / a bottom tray (mobile) give live control.
 *   - Back it: the chosen build flows into the reserve flow.
 */
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import ModelExperience from "../ModelExperience.vue";
import { setPref, getPref, onChange } from "../../lib/store";
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

const viewer = ref<any>(null);
const view = ref<"tour" | "customize">("tour");
const active = ref(0);
const scene = computed<LandingScene | undefined>(() => props.journey[active.value]);

// phone gets its own camera frames + floor-panel placement (narrow portrait)
const isPhone = ref(false);
function checkPhone() { isPhone.value = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches; }

// ── customizer config (mirrors the viewer's per-part colour) ──
const config = reactive<Record<string, string>>(
  Object.fromEntries(PARTS.map((p) => [p.id, p.options[0].color]))
);
const openPart = ref<string>(PARTS[0].id);
// persist the chosen build so the on-page backing section can show it
function persistBuild() {
  setPref("corydora.build", PARTS.map((p) => ({ id: p.id, label: p.label, color: config[p.id], name: labelFor(p.id) })));
}
const customized = ref(false); // once true, the cart follows the user down the page
function pick(partId: string, color: string) {
  config[partId] = color;
  const part = PARTS.find((p) => p.id === partId);
  viewer.value?.setPartColor(partId, color);
  // only the internal parts (switches, gasket) need the x-ray peek; the rest
  // are visible from the outside anyway
  if (part && (partId === "switches" || partId === "trim")) viewer.value?.flashPart?.(part.meshes);
  customized.value = true;     // changing anything makes it the user's live build/cart
  persistBuild();
  updateUrl();                 // keep the shareable URL live
}
function labelFor(partId: string): string {
  const part = PARTS.find((p) => p.id === partId);
  return part?.options.find((o) => o.color === config[partId])?.label ?? "";
}
function descFor(partId: string): string | undefined {
  const part = PARTS.find((p) => p.id === partId);
  return part?.options.find((o) => o.color === config[partId])?.desc;
}

// ── tour chapters ──
function applyScene(i: number) {
  active.value = (i + props.journey.length) % props.journey.length;
  const s = props.journey[active.value];
  const v = viewer.value;
  if (!v || !s) return;
  if (s.mode) v.setMode(s.mode);
  v.isolate(s.isolate ?? []);
  const cam = (isPhone.value && s.camMobile) ? s.camMobile : s.cam;
  if (cam) v.frameTo(cam, s.isolate);
  if (s.oled) v.setOled?.(s.oled);
  // everything printed on the floor around the model, in editorial type
  v.setStoryFloor?.({
    eyebrow: s.eyebrow,
    script: s.script,
    title: s.bigType,
    body: s.body,
    specs: s.spec ? props.specs : undefined,
    dims: s.id === "meet",
    panel: s.panel,
    panelPos: isPhone.value ? s.panelMobile : undefined,
    fade: true,
  });
  v.setFloorLogo?.(true);
}
const next = () => applyScene(active.value + 1);
const prev = () => applyScene(active.value - 1);

// ── mode switching ──
function enterTour() { view.value = "tour"; applyScene(active.value); }
function enterCustomize() {
  view.value = "customize";
  const v = viewer.value; if (!v) return;
  v.setMode("Studio"); v.isolate([]);
  const cam = (isPhone.value && props.customizeCamMobile) ? props.customizeCamMobile : scene.value?.cam;
  if (cam) v.frameTo(cam);
  // print the customise heading on the floor too (like the tour chapters)
  v.setStoryFloor?.({ eyebrow: "Yours, down to the colour", title: "MAKE IT\nYOURS", fade: true });
  v.setFloorLogo?.(false);
}
// "Back it" lives on the main page now - scroll to it rather than overlay the 3D
function enterBack() {
  if (typeof document !== "undefined") document.getElementById("back")?.scrollIntoView({ behavior: "smooth" });
}

// ── reserve + cart ──
const cart = ref<any>(null);
const reloadCart = () => { cart.value = getPref("corydora.cart", null); };
function reserveBuild() {
  // a tiny set of values describing the reserved build -> shown as a "cart"
  const build = PARTS.map((p) => ({ id: p.id, label: p.label, color: config[p.id], name: labelFor(p.id) }));
  setPref("corydora.cart", { build, ts: Date.now() });
  reloadCart();
  enterBack(); // head to the tiers to finish the reservation
}

// ── readable, live build URL (?body=cream&trim=orange&keycaps=purple…) ──
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function buildQuery(): string {
  return PARTS.map((p) => {
    const o = p.options.find((o) => o.color === config[p.id]);
    return `${p.id}=${slug(o?.label || "")}`;
  }).join("&");
}
function updateUrl() {
  if (typeof history === "undefined") return;
  history.replaceState(null, "", `${location.pathname}?${buildQuery()}`);
}
const shared = ref(false);
function shareBuild() {
  updateUrl(); // the URL already tracks live, just make sure + copy it
  navigator.clipboard?.writeText(location.href).catch(() => {});
  shared.value = true; setTimeout(() => (shared.value = false), 1800);
}
// read an incoming shared build (by readable option name), applied once ready
let incomingBuild = false;
function readSharedBuild() {
  try {
    const sp = new URLSearchParams(location.search);
    let found = false;
    for (const p of PARTS) {
      const v = sp.get(p.id); if (!v) continue;
      const o = p.options.find((o) => slug(o.label) === v);
      if (o) { config[p.id] = o.color; found = true; }
    }
    if (found) incomingBuild = true;
  } catch {}
}

function onResize() {
  const was = isPhone.value; checkPhone();
  if (was === isPhone.value || !viewer.value?.ready) return; // only re-frame when crossing the breakpoint
  if (view.value === "customize") enterCustomize(); else applyScene(active.value);
}
onMounted(() => {
  checkPhone();
  window.addEventListener("resize", onResize);
  readSharedBuild();
  persistBuild(); // seed the page backing section with the (possibly shared) build
  reloadCart();
  onChange(reloadCart);
});
onUnmounted(() => window.removeEventListener("resize", onResize));

// once the model is ready: apply a shared build into Customise, else play chapter 1
const started = ref(false);
watch(
  () => viewer.value?.ready,
  (r) => {
    if (!r || started.value) return;
    started.value = true;
    if (incomingBuild) {
      // a shared build is just a PREVIEW - not the user's cart until they tweak it
      for (const p of PARTS) viewer.value.setPartColor(p.id, config[p.id]);
      enterCustomize();
    } else {
      applyScene(0);
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="cx" :class="`cx--${view}`">
    <div class="cx-stage">
      <ModelExperience
        ref="viewer"
        :src="src"
        :alt="alt"
        :dimensions="dimensions"
        variant="page"
        embedded
      />

      <!-- mode switch (always available) -->
      <div class="cx-modes">
        <button class="cx-mode" :class="{ active: view === 'tour' }" @click="enterTour">
          <i class="ph-bold ph-play-circle"></i><span>Story</span>
        </button>
        <button class="cx-mode" :class="{ active: view === 'customize' }" @click="enterCustomize">
          <i class="ph-bold ph-paint-brush-broad"></i><span>Customise</span>
        </button>
        <button class="cx-mode cx-mode--cta" @click="enterBack">
          <i class="ph-bold ph-hand-heart"></i><span>Back it</span>
        </button>
      </div>

      <!-- ===== TOUR: headings print on the floor; longer copy + facts stay as a
           readable overlay (bottom-left), chapter nav bottom-centre. ===== -->
      <div v-show="view === 'tour'" class="cx-edit" v-if="scene">
        <transition name="cx-fade" mode="out-in">
          <div class="cx-copy" :key="active">
            <p class="cx-body">{{ scene.body }}</p>
            <ul v-if="scene.spec && specs?.length" class="cx-facts">
              <li v-for="s in specs" :key="s.label"><span>{{ s.label }}</span><b>{{ s.value }}</b></li>
            </ul>
          </div>
        </transition>
        <div class="cx-nav">
          <button class="cx-arrow" @click="prev" aria-label="Previous chapter"><i class="ph-bold ph-caret-left"></i></button>
          <div class="cx-dots">
            <button v-for="(s, i) in journey" :key="s.id" class="cx-dot" :class="{ active: i === active }" @click="applyScene(i)" :aria-label="`Go to ${s.title}`" />
          </div>
          <button class="cx-arrow" @click="next" aria-label="Next chapter"><i class="ph-bold ph-caret-right"></i></button>
        </div>
      </div>

      <!-- ===== CUSTOMISE: transparent tool layer ===== -->
      <template v-if="view === 'customize'">
        <!-- left: live colour controls (no boxes, fully transparent) -->
        <div class="cx-tools">
          <p class="cx-tools-h">Make it yours</p>
          <div v-for="part in PARTS" :key="part.id" class="cx-tool" :class="{ open: openPart === part.id }">
            <button class="cx-tool-head" @click="openPart = openPart === part.id ? '' : part.id">
              <span class="cx-tool-dot" :style="{ background: config[part.id] }"></span>
              <span class="cx-tool-name">{{ part.label }}</span>
              <span class="cx-tool-val">{{ labelFor(part.id) }}</span>
            </button>
            <div v-show="openPart === part.id" class="cx-tool-body">
              <div class="cx-tool-sw">
                <button
                  v-for="o in part.options"
                  :key="o.color"
                  class="cx-sw"
                  :class="{ active: config[part.id] === o.color }"
                  :style="{ background: o.color }"
                  :title="o.desc ? `${o.label} — ${o.desc}` : o.label"
                  @click="pick(part.id, o.color)"
                />
              </div>
              <p v-if="descFor(part.id)" class="cx-tool-desc">{{ descFor(part.id) }}</p>
            </div>
          </div>
        </div>

        <!-- right: make-it-yours copy (desktop only; heading is on the floor) -->
        <div class="cx-cust-copy">
          <p class="cx-cust-p">Case, trim, keycaps, switches and knob - mix and match to taste. The model updates live as you go. Pick your switch feel too: linear, tactile or clicky.</p>
          <p class="cx-cust-p cx-cust-muted">Happy with it? Reserve it and your exact build carries through to checkout.</p>
          <div class="cx-cust-actions">
            <button class="cx-tb" @click="reserveBuild"><i class="ph-bold ph-hand-heart"></i> Reserve this build</button>
            <button class="cx-share" @click="shareBuild" :title="shared ? 'Link copied!' : 'Copy a shareable link to this build'">
              <i :class="shared ? 'ph-bold ph-check' : 'ph-bold ph-share-network'"></i> {{ shared ? "Copied" : "Share" }}
            </button>
          </div>
        </div>

        <!-- mobile-only pinned action bar (Reserve + Share always reachable) -->
        <div class="cx-mobile-actions">
          <button class="cx-tb" @click="reserveBuild"><i class="ph-bold ph-hand-heart"></i> Reserve</button>
          <button class="cx-share" @click="shareBuild">
            <i :class="shared ? 'ph-bold ph-check' : 'ph-bold ph-share-network'"></i> {{ shared ? "Copied" : "Share" }}
          </button>
        </div>
      </template>

      <!-- cart chip: follows the user (fixed) once they've customised a build -->
      <button v-if="customized || cart" class="cx-cart" @click="enterBack" title="Your build">
        <i class="ph-bold ph-shopping-cart-simple"></i>
        <span class="cx-cart-dots">
          <span v-for="p in PARTS" :key="p.id" class="cx-cart-dot" :style="{ background: config[p.id] }"></span>
        </span>
        <span class="cx-cart-label">Your build</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.cx { width: 100%; }
.cx-stage { position: relative; width: 100%; }

/* chapter copy cross-fade */
.cx-fade-enter-active, .cx-fade-leave-active { transition: opacity 0.35s ease, transform 0.35s ease; }
.cx-fade-enter-from, .cx-fade-leave-to { opacity: 0; transform: translateY(8px); }

/* mode switch */
.cx-modes { position: absolute; top: 12px; left: 12px; z-index: 10; display: flex; gap: 0.4rem; }
.cx-mode {
  display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer;
  padding: 0.5rem 0.85rem; border-radius: 999px; font-size: 0.82rem; font-weight: 800;
  border: 1px solid rgba(255,255,255,0.16); background: rgba(10,10,12,0.55); color: #faf3e8;
  backdrop-filter: blur(8px); transition: all 0.15s;
}
.cx-mode.active { background: #ff5900; border-color: #ff5900; color: #fff; }
.cx-mode--cta { background: rgba(255,89,0,0.18); border-color: rgba(255,89,0,0.5); color: #ffb98a; }

/* ── tour editorial ── */
.cx-edit { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
.cx-edit > * { pointer-events: auto; }
.cx-copy { position: absolute; left: 1.5rem; bottom: 4.5rem; max-width: 24rem; }
.cx-body { font-size: 0.95rem; line-height: 1.6; color: #f3ece0; text-shadow: 0 1px 12px rgba(0,0,0,0.7); }
.cx-facts { margin-top: 0.85rem; display: grid; grid-template-columns: 1fr; gap: 0.15rem; }
.cx-facts li { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.78rem; color: #cdbfa6; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 0.15rem 0; }
.cx-facts li b { color: #faf3e8; font-weight: 700; }
@media (max-width: 720px) {
  .cx-copy { left: 1rem; right: 1rem; bottom: 5.5rem; max-width: none; }
  .cx-facts { display: none; }
}
.cx-edit-head { position: absolute; top: 5.5rem; left: 1.5rem; max-width: 18rem; }
.cx-eyebrow { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #ff9a5c; }
.cx-script { font-family: "Fraunces", serif; font-style: italic; font-weight: 500; font-size: 1.9rem; color: #faf3e8; line-height: 1.05; margin-top: 0.2rem; }
.cx-big {
  position: absolute; top: 4.5rem; right: 1.5rem; margin: 0; text-align: right;
  font-family: "Fraunces", serif; font-weight: 900; font-size: clamp(2.4rem, 7vw, 5.5rem);
  line-height: 0.9; color: #faf3e8; white-space: pre-line; letter-spacing: -0.01em;
  text-shadow: 0 2px 30px rgba(0,0,0,0.5);
}
.cx-spec {
  position: absolute; top: 30%; right: 1.5rem; width: 13rem; pointer-events: auto;
  background: #faf3e8; color: #1a1a1a; border: 2px solid #1a1a1a; border-radius: 4px;
  padding: 0.5rem 0.7rem; font-family: "DM Sans", sans-serif;
}
.cx-spec-h { font-weight: 900; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; border-bottom: 3px solid #1a1a1a; padding-bottom: 0.25rem; margin-bottom: 0.25rem; }
.cx-spec-row { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.7rem; border-bottom: 1px solid rgba(26,26,26,0.2); padding: 0.12rem 0; }
.cx-spec-row b { font-weight: 800; text-align: right; }

.cx-edit-foot { position: absolute; left: 1.5rem; bottom: 5rem; max-width: 26rem; }
.cx-title { font-family: "Fraunces", serif; font-weight: 800; font-size: 1.4rem; color: #faf3e8; margin-bottom: 0.35rem; }
.cx-body { font-size: 0.92rem; line-height: 1.55; color: #e6ddcd; }
.cx-files { margin-top: 0.85rem; }
.cx-files-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #ff9a5c; }

.cx-nav { position: absolute; left: 50%; transform: translateX(-50%); bottom: 1.25rem; display: flex; align-items: center; gap: 0.8rem; }
.cx-arrow { width: 40px; height: 40px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(10,10,12,0.55); color: #faf3e8; cursor: pointer; display: grid; place-items: center; backdrop-filter: blur(8px); }
.cx-arrow:hover { border-color: #ff6c1e; color: #ff9a5c; }
.cx-dots { display: flex; gap: 0.45rem; }
.cx-dot { width: 9px; height: 9px; border-radius: 999px; border: none; background: rgba(255,255,255,0.3); cursor: pointer; padding: 0; }
.cx-dot.active { background: #ff6c1e; width: 22px; }

/* ── customise tool layer (fully transparent, no boxes) ── */
.cx-tools { position: absolute; top: 5.5rem; left: 1.5rem; z-index: 8; width: 15rem; display: flex; flex-direction: column; gap: 0.15rem; }
.cx-tools-h { font-family: "Fraunces", serif; font-weight: 800; font-size: 1.15rem; color: #faf3e8; margin-bottom: 0.4rem; text-shadow: 0 1px 10px rgba(0,0,0,0.6); }
.cx-tool { background: none; border: none; }
.cx-tool-head { width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.1rem; background: none; border: none; cursor: pointer; text-shadow: 0 1px 8px rgba(0,0,0,0.7); }
.cx-tool-dot { width: 16px; height: 16px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.35); flex-shrink: 0; }
.cx-tool-name { font-weight: 700; font-size: 0.85rem; color: #faf3e8; }
.cx-tool-val { margin-left: auto; font-size: 0.72rem; color: #cdbfa6; }
.cx-tool-body { padding: 0.1rem 0.1rem 0.5rem; }
.cx-tool-sw { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.cx-tool-desc { margin-top: 0.45rem; font-size: 0.74rem; line-height: 1.4; color: #e6ddcd; text-shadow: 0 1px 8px rgba(0,0,0,0.7); }
.cx-sw { width: 26px; height: 26px; border-radius: 7px; cursor: pointer; border: 2px solid rgba(255,255,255,0.3); transition: transform 0.12s, box-shadow 0.12s; }
.cx-sw:hover { transform: translateY(-2px); }
.cx-sw.active { box-shadow: 0 0 0 2px rgba(10,10,12,0.8), 0 0 0 4px #ff5900; }

/* right-side "make it yours" copy */
.cx-cust-copy { position: absolute; top: 5.5rem; right: 1.5rem; z-index: 8; max-width: 20rem; text-align: right; text-shadow: 0 1px 12px rgba(0,0,0,0.7); }
.cx-cust-eyebrow { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #ff9a5c; }
.cx-cust-h { font-family: "Fraunces", serif; font-weight: 800; font-size: 1.5rem; line-height: 1.1; color: #faf3e8; margin: 0.3rem 0 0.5rem; }
.cx-cust-p { font-size: 0.9rem; line-height: 1.55; color: #e6ddcd; margin-bottom: 0.6rem; }
.cx-cust-muted { color: #cdbfa6; font-size: 0.82rem; }
.cx-cust-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem; }
.cx-tb { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.2rem; border-radius: 999px; border: none; background: #ff5900; color: #fff; font-weight: 800; cursor: pointer; }
.cx-tb:hover { background: #e04e00; }
.cx-share { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.3); background: rgba(10,10,12,0.4); color: #faf3e8; font-weight: 700; cursor: pointer; backdrop-filter: blur(6px); }
.cx-share:hover { border-color: #ff6c1e; color: #ff9a5c; }

.cx-mobile-actions { display: none; }

/* cart chip - fixed so it follows the user down the page once a build exists */
.cx-cart { position: fixed; top: 12px; right: 12px; z-index: 50; display: inline-flex; align-items: center; gap: 0.45rem;
  padding: 0.4rem 0.7rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18);
  background: rgba(10,10,12,0.75); color: #faf3e8; font-size: 0.8rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(8px); }
.cx-cart:hover { border-color: #ff6c1e; }
.cx-cart-dots { display: inline-flex; gap: 2px; }
.cx-cart-dot { width: 11px; height: 11px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.25); }
.cx-cart-label { white-space: nowrap; }

@media (max-width: 720px) {
  .cx-big { font-size: clamp(2rem, 11vw, 3.2rem); top: 4rem; }
  .cx-spec { display: none; }
  .cx-edit-head { top: 4.5rem; left: 1rem; }
  .cx-edit-foot { left: 1rem; right: 1rem; bottom: 6rem; max-width: none; }

  /* mode switch: icons only, no labels */
  .cx-mode span { display: none; }
  .cx-mode { padding: 0.5rem 0.6rem; }

  /* customiser = a bottom sheet (rows scroll) sitting ABOVE a pinned action bar */
  .cx-tools { top: auto; bottom: 3.6rem; left: 0; right: 0; width: auto; gap: 0.15rem;
    padding: 0.8rem 1rem 0.6rem; max-height: 42vh; overflow-y: auto;
    background: linear-gradient(to top, rgba(8,9,12,0.92), rgba(8,9,12,0)); }
  .cx-cust-copy { display: none; } /* descriptive copy hidden on phone (heading is on the floor) */

  .cx-mobile-actions { display: flex; gap: 0.5rem; position: absolute; left: 0; right: 0; bottom: 0;
    z-index: 9; padding: 0.5rem 0.8rem; background: rgba(8,9,12,0.95); border-top: 1px solid rgba(255,255,255,0.1); }
  .cx-mobile-actions .cx-tb { flex: 1; justify-content: center; }
  .cx-mobile-actions .cx-share { justify-content: center; }

  /* cart stays top-right (fixed) and compact - just icon + dots */
  .cx-cart-label { display: none; }
}
</style>
