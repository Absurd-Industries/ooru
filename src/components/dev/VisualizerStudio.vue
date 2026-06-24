<script setup lang="ts">
/**
 * Visualizer Studio - a dev tool for authoring 3D "folios" with the viewer.
 *
 *  1. Drop in a .glb and it loads centred, where CoryDora normally sits.
 *  2. Add / remove / select camera "frames" (snapshots of the current view).
 *  3. Write text on the floor per frame, Figma-style: pick a style, edit it in
 *     the sidebar, and drag it around on the floor (Move mode). Export the lot
 *     as JSON to paste into a landing's journey data.
 */
import { ref, reactive, computed, watch, onMounted } from "vue";
import ModelExperience from "../ModelExperience.vue";

type Cam = { pos: [number, number, number]; target: [number, number, number] };
type Role = "eyebrow" | "script" | "title" | "body" | "label";
interface TextItem { id: number; content: string; role: Role; x: number; z: number; h: number; rot: number }
interface Frame { id: number; name: string; cam: Cam | null; texts: TextItem[] }

const ROLES: Role[] = ["title", "eyebrow", "script", "body", "label"];
const DEFAULT_ROT = -90; // matches the viewer's FLOOR_TEXT_ROT so text faces the start view

let uid = 1;
const nextId = () => uid++;

const viewer = ref<any>(null);
const modelSrc = ref("/models/cory-dora.glb");
const modelName = ref("cory-dora.glb");

const frames = reactive<Frame[]>([{ id: nextId(), name: "Frame 1", cam: null, texts: [] }]);
const activeIdx = ref(0);
const selectedId = ref<number | null>(null);
const moveMode = ref(false);
const exportOpen = ref(false);

const active = computed<Frame | undefined>(() => frames[activeIdx.value]);
const selected = computed<TextItem | undefined>(() => active.value?.texts.find((t) => t.id === selectedId.value));
const capacity = computed<number>(() => viewer.value?.floorCapacity?.() ?? 6);

// ── floor rendering ──
function renderFloor() {
  const v = viewer.value; const f = active.value; if (!v?.setFloorItems || !f) return;
  const specs = f.texts.map((t) => {
    const lines = t.content.split("\n");
    return {
      ...(lines.length > 1 ? { lines } : { text: t.content }),
      role: t.role, x: t.x, z: t.z, h: t.h, rot: (t.rot * Math.PI) / 180,
    };
  });
  v.setFloorItems(specs);
}

function applyActiveFrame() {
  const v = viewer.value; const f = active.value; if (!v || !f) return;
  if (f.cam) v.frameTo(f.cam);
  renderFloor();
}

// ── frames ──
function addFrame() {
  const cam = viewer.value?.getCam?.() ?? null;
  frames.push({ id: nextId(), name: `Frame ${frames.length + 1}`, cam, texts: [] });
  activeIdx.value = frames.length - 1;
  selectedId.value = null;
  renderFloor();
}
function selectFrame(i: number) {
  activeIdx.value = i; selectedId.value = null; moveMode.value = false;
  applyActiveFrame();
}
function deleteFrame(i: number) {
  if (frames.length === 1) { frames[0].texts = []; frames[0].cam = null; selectedId.value = null; renderFloor(); return; }
  frames.splice(i, 1);
  activeIdx.value = Math.max(0, Math.min(activeIdx.value, frames.length - 1));
  selectedId.value = null;
  applyActiveFrame();
}
function recaptureCam() { const f = active.value; if (f) f.cam = viewer.value?.getCam?.() ?? f.cam; }

// ── text items ──
function addText() {
  const f = active.value; if (!f) return;
  if (f.texts.length >= capacity.value) { alert(`Max ${capacity.value} text items per frame.`); return; }
  // spawn on open floor in FRONT of the model (0,0 would sit hidden under it),
  // staggered so successive adds don't stack on top of each other
  const n = f.texts.length;
  const t: TextItem = { id: nextId(), content: "New text", role: "title", x: -40 + (n % 3) * 40, z: 110 - Math.floor(n / 3) * 28, h: 18, rot: DEFAULT_ROT };
  f.texts.push(t); selectedId.value = t.id; renderFloor();
}
function deleteText(id: number) {
  const f = active.value; if (!f) return;
  f.texts = f.texts.filter((t) => t.id !== id);
  if (selectedId.value === id) selectedId.value = null;
  renderFloor();
}
function selectText(id: number) { selectedId.value = id; }

// edits in the sidebar re-render the floor live
watch(frames, renderFloor, { deep: true });

// ── GLB drop / pick ──
function loadFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb")) { alert("Please drop a .glb file."); return; }
  modelSrc.value = URL.createObjectURL(file);
  modelName.value = file.name;
}
function onDrop(e: DragEvent) { const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f); }
function onPick(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) loadFile(f); }

// ── drag on the floor (Move mode) ──
const dragging = ref(false);
function onStagePointerDown(e: PointerEvent) {
  if (!moveMode.value || !selected.value) return;
  dragging.value = true; placeAt(e);
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onStagePointerMove(e: PointerEvent) { if (dragging.value) placeAt(e); }
function onStagePointerUp() { dragging.value = false; }
function placeAt(e: PointerEvent) {
  const t = selected.value; const gp = viewer.value?.groundPoint?.(e.clientX, e.clientY);
  if (t && gp) { t.x = gp.x; t.z = gp.z; } // watcher re-renders
}

// ── viewer lifecycle: re-apply the active frame whenever the model is ready ──
watch(() => viewer.value?.ready, (r) => { if (r) applyActiveFrame(); });

// ── export ──
const exportJson = computed(() =>
  JSON.stringify(
    frames.map((f) => ({
      name: f.name,
      cam: f.cam,
      texts: f.texts.map((t) => ({ content: t.content, role: t.role, x: t.x, z: t.z, h: t.h, rot: t.rot })),
    })),
    null, 2,
  ),
);
function copyExport() { navigator.clipboard?.writeText(exportJson.value); }

onMounted(() => { document.title = "Visualizer Studio"; });
</script>

<template>
  <div class="st">
    <!-- ===== stage ===== -->
    <div class="st-stage" @dragover.prevent @drop.prevent="onDrop">
      <ModelExperience :key="modelSrc" ref="viewer" :src="modelSrc" alt="model" embedded variant="page" />
      <!-- drag overlay: only swallows pointer events while moving a text -->
      <div
        v-if="moveMode && selected"
        class="st-drag"
        @pointerdown="onStagePointerDown"
        @pointermove="onStagePointerMove"
        @pointerup="onStagePointerUp"
        @pointerleave="onStagePointerUp"
      >
        <span class="st-drag-hint">Drag “{{ selected.content.split("\n")[0] }}” on the floor · click Move to stop</span>
      </div>
    </div>

    <!-- ===== sidebar ===== -->
    <aside class="st-side">
      <header class="st-head">
        <h1>Visualizer Studio</h1>
        <label class="st-drop">
          <i class="ph-bold ph-upload-simple"></i>
          <span>{{ modelName }}</span>
          <input type="file" accept=".glb" @change="onPick" hidden />
        </label>
        <p class="st-hint">Drop a .glb anywhere on the canvas, or pick one above.</p>
      </header>

      <!-- frames -->
      <section class="st-sec">
        <div class="st-sec-h"><span>Frames</span><button class="st-mini" @click="addFrame"><i class="ph-bold ph-plus"></i> Capture</button></div>
        <ul class="st-frames">
          <li v-for="(f, i) in frames" :key="f.id" :class="{ on: i === activeIdx }">
            <button class="st-frame" @click="selectFrame(i)">
              <i class="ph-bold" :class="f.cam ? 'ph-camera' : 'ph-camera-slash'"></i>
              <input class="st-frame-name" v-model="f.name" @click.stop />
              <small>{{ f.texts.length }} text</small>
            </button>
            <button class="st-x" @click="deleteFrame(i)" title="Delete frame"><i class="ph-bold ph-trash"></i></button>
          </li>
        </ul>
        <button class="st-wide" @click="recaptureCam" :disabled="!active"><i class="ph-bold ph-arrows-clockwise"></i> Re-capture camera for this frame</button>
      </section>

      <!-- text items for the active frame -->
      <section class="st-sec" v-if="active">
        <div class="st-sec-h">
          <span>Floor text</span>
          <span class="st-toggles">
            <button class="st-mini" :class="{ active: moveMode }" @click="moveMode = !moveMode" :disabled="!selected"><i class="ph-bold ph-arrows-out-cardinal"></i> Move</button>
            <button class="st-mini" @click="addText"><i class="ph-bold ph-plus"></i> Add</button>
          </span>
        </div>
        <ul class="st-texts">
          <li v-for="t in active.texts" :key="t.id" :class="{ on: t.id === selectedId }">
            <button class="st-text" @click="selectText(t.id)"><i class="ph-bold ph-text-aa"></i> {{ t.content.split("\n")[0] || "(empty)" }} <em>{{ t.role }}</em></button>
            <button class="st-x" @click="deleteText(t.id)"><i class="ph-bold ph-trash"></i></button>
          </li>
        </ul>
        <p v-if="!active.texts.length" class="st-hint">No floor text yet. Click <b>Add</b>.</p>

        <!-- selected text editor -->
        <div class="st-edit" v-if="selected">
          <label>Text<textarea v-model="selected.content" rows="2"></textarea></label>
          <label>Style
            <select v-model="selected.role">
              <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
            </select>
          </label>
          <div class="st-row">
            <label>Size<input type="number" step="1" v-model.number="selected.h" /></label>
            <label>Rotation°<input type="number" step="5" v-model.number="selected.rot" /></label>
          </div>
          <div class="st-row">
            <label>X<input type="number" step="2" v-model.number="selected.x" /></label>
            <label>Z<input type="number" step="2" v-model.number="selected.z" /></label>
          </div>
        </div>
      </section>

      <!-- export -->
      <section class="st-sec">
        <div class="st-sec-h"><span>Export</span><button class="st-mini" @click="exportOpen = !exportOpen"><i class="ph-bold ph-code"></i> {{ exportOpen ? "Hide" : "Show" }}</button></div>
        <template v-if="exportOpen">
          <button class="st-wide" @click="copyExport"><i class="ph-bold ph-copy"></i> Copy JSON</button>
          <textarea class="st-json" readonly :value="exportJson" rows="10"></textarea>
        </template>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.st { position: relative; height: 100vh; overflow: hidden; background: #0e1014; color: #e9e2d4; font-family: "DM Sans", system-ui, sans-serif; }

/* stage = full screen 3D */
.st-stage { position: absolute; inset: 0; z-index: 0; }
.st-stage :deep(.mx-stage), .st-stage :deep(.mx-stage--page) { height: 100% !important; min-height: 0 !important; max-height: none !important; border-radius: 0; }
.st-drag { position: absolute; inset: 0; z-index: 20; cursor: grab; }
.st-drag:active { cursor: grabbing; }
.st-drag-hint { position: absolute; top: 12px; left: 12px; background: rgba(255,89,0,0.92); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 0.35rem 0.7rem; border-radius: 6px; }

/* sidebar = a floating glass panel (like the customizer), scrollable */
.st-side { position: absolute; top: 1rem; right: 1rem; bottom: 1rem; width: 340px; z-index: 30;
  overflow-y: auto; overscroll-behavior: contain;
  background: rgba(18,20,26,0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; box-shadow: 0 18px 50px rgba(0,0,0,0.55); }
@media (max-width: 640px) {
  .st-side { left: 0.5rem; right: 0.5rem; width: auto; top: auto; bottom: 0.5rem; max-height: 60vh; }
}
.st-head { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
.st-head h1 { font-family: "Fraunces", serif; font-weight: 800; font-size: 1.1rem; margin: 0 0 0.7rem; }
.st-drop { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.8rem; border: 1px dashed rgba(255,255,255,0.25); border-radius: 8px; cursor: pointer; font-size: 0.82rem; font-weight: 600; }
.st-drop:hover { border-color: #ff5900; color: #ff9a5c; }
.st-drop span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-hint { font-size: 0.74rem; color: #8b8170; margin: 0.6rem 0 0; }

.st-sec { padding: 0.9rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
.st-sec-h { display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #ff9a5c; margin-bottom: 0.6rem; }
.st-toggles { display: flex; gap: 0.3rem; }
.st-mini { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 5px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: #cdbfa6; cursor: pointer; }
.st-mini:hover:not(:disabled) { border-color: #ff5900; color: #ff9a5c; }
.st-mini.active { background: #ff5900; border-color: #ff5900; color: #fff; }
.st-mini:disabled { opacity: 0.4; cursor: not-allowed; }

.st-frames, .st-texts { list-style: none; margin: 0 0 0.6rem; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.st-frames li, .st-texts li { display: flex; align-items: center; gap: 0.25rem; border-radius: 6px; }
.st-frames li.on, .st-texts li.on { background: rgba(255,89,0,0.14); }
.st-frame, .st-text { flex: 1; display: flex; align-items: center; gap: 0.45rem; background: transparent; border: none; color: inherit; text-align: left; padding: 0.4rem 0.5rem; cursor: pointer; font-size: 0.82rem; min-width: 0; }
.st-frame small, .st-text em { margin-left: auto; color: #8b8170; font-size: 0.68rem; font-style: normal; }
.st-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-frame-name { flex: 1; min-width: 0; background: transparent; border: none; color: inherit; font-size: 0.82rem; font-weight: 600; padding: 0; }
.st-frame-name:focus { outline: 1px solid rgba(255,89,0,0.5); border-radius: 3px; }
.st-x { background: transparent; border: none; color: #6b6356; cursor: pointer; padding: 0.3rem; }
.st-x:hover { color: #ff6c1e; }

.st-wide { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; font-size: 0.76rem; font-weight: 700; padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: #cdbfa6; cursor: pointer; }
.st-wide:hover:not(:disabled) { border-color: #ff5900; color: #ff9a5c; }
.st-wide:disabled { opacity: 0.4; }

.st-edit { margin-top: 0.7rem; display: flex; flex-direction: column; gap: 0.5rem; padding-top: 0.7rem; border-top: 1px solid rgba(255,255,255,0.08); }
.st-edit label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8b8170; }
.st-row { display: flex; gap: 0.5rem; }
.st-row label { flex: 1; }
.st-edit input, .st-edit select, .st-edit textarea { background: #0e1014; border: 1px solid rgba(255,255,255,0.15); border-radius: 5px; color: #e9e2d4; font: inherit; font-size: 0.82rem; padding: 0.35rem 0.5rem; }
.st-edit textarea { resize: vertical; }

.st-json { width: 100%; margin-top: 0.5rem; background: #0e1014; border: 1px solid rgba(255,255,255,0.15); border-radius: 5px; color: #9fd1a0; font-family: ui-monospace, monospace; font-size: 0.72rem; padding: 0.5rem; resize: vertical; }
</style>
