<script setup lang="ts">
/**
 * ModelExperience - a custom Three.js viewer for a multi-part product GLB.
 *
 * Two modes:
 *  - Tour: steps that frame each part with a camera move + an annotation.
 *  - Customize: pick a part; it stays solid + recolourable while every other
 *    part goes ghost-transparent with just its black edges showing, so it's
 *    obvious what you're editing.
 *
 * The model sits on a real 3D ground plane (kraft or cassette-tech) that orbits
 * with the camera. Lighting is a studio HDR + a key light for contact shadow.
 *
 * Requires the GLB to have one mesh per part, materials named by part
 * (frontplate / backplate / trim / keycaps / switches / knob / pcb / interior),
 * produced by tools/step-colorize.mjs with "separate": true.
 */
import { ref, shallowRef, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const props = defineProps<{
  src: string;
  alt?: string;
  /** Real-world size in mm, shown as a scale chip. */
  dimensions?: { w: number; d: number; h: number };
}>();

// ── Tour + customizer config (keyed to the GLB part/material names) ──────
interface TourStep { part: string | null; title: string; body: string; }
const TOUR: TourStep[] = [
  { part: null, title: "Meet CoryDora", body: "A fully open-source 3×3 QMK macropad. Spin it around - then build your own below." },
  { part: "keycaps", title: "Nine hot-swap keys", body: "DSA-profile caps on MX hotswap sockets. Swap switches by hand, no soldering." },
  { part: "knob", title: "Rotary encoder", body: "Twist for volume, scrolling, brush size - anything you can map." },
  { part: "frontplate", title: "Top plate + OLED", body: "A 3D-printed top plate framing the 0.91\" OLED status display." },
  { part: "pcb", title: "Open-source PCB", body: "KiCad design driven by an RP2040. Every schematic and gerber is public." },
  { part: "trim", title: "Accent trim", body: "The signature gasket line - your pop of colour around the seam." },
];

interface PartOpt { label: string; color: string; }
interface PartCfg { id: string; label: string; options: PartOpt[]; }
const PARTS: PartCfg[] = [
  { id: "frontplate", label: "Top plate", options: [
    { label: "Cream", color: "#E7DCC2" }, { label: "White", color: "#F2EEE6" },
    { label: "Black", color: "#1D1D1F" }, { label: "Blue", color: "#1F8FD6" },
    { label: "Mint", color: "#7AD6B0" } ] },
  { id: "backplate", label: "Bottom plate", options: [
    { label: "Cream", color: "#E7DCC2" }, { label: "White", color: "#F2EEE6" },
    { label: "Black", color: "#1D1D1F" }, { label: "Blue", color: "#1F8FD6" },
    { label: "Mint", color: "#7AD6B0" } ] },
  { id: "trim", label: "Trim / gasket", options: [
    { label: "Orange", color: "#F2851F" }, { label: "Purple", color: "#6B4DB3" },
    { label: "Lime", color: "#B6D641" }, { label: "Pink", color: "#E7779E" },
    { label: "Black", color: "#1D1D1F" } ] },
  { id: "keycaps", label: "Keycaps", options: [
    { label: "Purple", color: "#6B4DB3" }, { label: "Lavender", color: "#B9A3E3" },
    { label: "Pink", color: "#E7A6C6" }, { label: "Cream", color: "#ECE3D2" },
    { label: "Blue", color: "#2F6FB0" }, { label: "Black", color: "#222226" } ] },
  { id: "switches", label: "Switches", options: [
    { label: "Black", color: "#1C1C1E" }, { label: "Red", color: "#C0392B" },
    { label: "Brown", color: "#6B4A2B" }, { label: "Clear", color: "#D9D9DE" } ] },
  { id: "knob", label: "Knob", options: [
    { label: "Orange", color: "#F58A21" }, { label: "Black", color: "#1D1D1F" },
    { label: "Purple", color: "#6B4DB3" }, { label: "Cream", color: "#E7DCC2" } ] },
];

// ── Reactive UI state ───────────────────────────────────────────────────
const mode = ref<"tour" | "customize">("tour");
const tourIndex = ref(0);
const activePart = ref<string>(PARTS[0].id);
const ground = ref<"kraft" | "cassette">("kraft");
const chosen = ref<Record<string, string>>(
  Object.fromEntries(PARTS.map((p) => [p.id, p.options[0].color]))
);
const loading = ref(true);
const failed = ref(false);
const annoLabel = ref<{ x: number; y: number; text: string } | null>(null);

const canvasWrap = ref<HTMLDivElement | null>(null);

// ── Three.js refs (non-reactive) ────────────────────────────────────────
const S = shallowRef<{
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera;
  controls: OrbitControls; meshes: Record<string, THREE.Mesh>; edges: Record<string, THREE.LineSegments>;
  baseColor: Record<string, THREE.Color>; groundMat: THREE.MeshStandardMaterial;
  kraftTex: THREE.Texture | null; cassetteTex: THREE.Texture | null;
  raf: number; tween: null | { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number; dur: number };
} | null>(null);

let disposed = false;

onMounted(() => {
  const wrap = canvasWrap.value;
  if (!wrap) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    failed.value = true; loading.value = false; return;
  }
  const w = wrap.clientWidth || 800, h = wrap.clientHeight || 460;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 5000);
  camera.position.set(180, 150, 220);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 60;
  controls.maxDistance = 900;
  controls.maxPolarAngle = Math.PI * 0.52; // don't go under the floor

  // Key light for contact shadow (HDR fills the rest)
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(120, 220, 140);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 10; key.shadow.camera.far = 800;
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160;
  key.shadow.bias = -0.0004;
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // Ground plane (orbits with camera since it's in the scene)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.95, metalness: 0,
    transparent: true, alphaMap: radialAlpha(), depthWrite: true,
  });
  const groundGeo = new THREE.CircleGeometry(420, 64);
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const meshes: Record<string, THREE.Mesh> = {};
  const edges: Record<string, THREE.LineSegments> = {};
  const baseColor: Record<string, THREE.Color> = {};

  S.value = { renderer, scene, camera, controls, meshes, edges, baseColor,
    groundMat, kraftTex: null, cassetteTex: null, raf: 0, tween: null };

  // Textures for the ground
  const texLoader = new THREE.TextureLoader();
  texLoader.load("/images/kraft-paper.jpg", (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace;
    if (S.value) { S.value.kraftTex = t; if (ground.value === "kraft") applyGround(); }
  });
  if (S.value) S.value.cassetteTex = cassetteTexture();
  applyGround();

  // HDR environment
  new RGBELoader().load("/hdr/studio.hdr", (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose(); pmrem.dispose();
  });

  // Load model
  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  loader.load(
    props.src,
    (gltf) => {
      if (disposed) return;
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry as THREE.BufferGeometry;
        if (!g.getAttribute("normal")) g.computeVertexNormals();
        const matName = ((m.material as THREE.MeshStandardMaterial)?.name || m.name || "")
          .replace(/-Mesh$/, "").toLowerCase();
        const std = m.material as THREE.MeshStandardMaterial;
        std.roughness = 0.62; std.metalness = 0.0; std.envMapIntensity = 1.0;
        m.castShadow = true; m.receiveShadow = true;
        meshes[matName] = m;
        baseColor[matName] = std.color.clone();
        // Black edge overlay (hidden until isolation)
        const eg = new THREE.EdgesGeometry(g, 32);
        const el = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x111111 }));
        el.visible = false;
        m.add(el);
        edges[matName] = el;
      });

      // Center on origin, rest on the ground (y=0)
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y -= box.min.y;
      scene.add(root);

      // Frame whole model
      goToStep(0, true);
      loading.value = false;
    },
    undefined,
    () => { failed.value = true; loading.value = false; }
  );

  // Resize
  const ro = new ResizeObserver(() => {
    if (!S.value) return;
    const ww = wrap.clientWidth, hh = wrap.clientHeight;
    if (!ww || !hh) return;
    S.value.camera.aspect = ww / hh;
    S.value.camera.updateProjectionMatrix();
    S.value.renderer.setSize(ww, hh);
  });
  ro.observe(wrap);

  // Render loop
  const tmp = new THREE.Vector3();
  function loop() {
    if (!S.value || disposed) return;
    S.value.raf = requestAnimationFrame(loop);
    const st = S.value;
    if (st.tween) {
      const k = Math.min(1, (performance.now() - st.tween.start) / st.tween.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
      st.camera.position.lerpVectors(st.tween.from, st.tween.to, e);
      st.controls.target.lerpVectors(st.tween.tFrom, st.tween.tTo, e);
      if (k >= 1) st.tween = null;
    }
    st.controls.update();
    st.renderer.render(st.scene, st.camera);
    // Annotation position
    if (mode.value === "tour") {
      const step = TOUR[tourIndex.value];
      if (step?.part && meshes[step.part]) {
        new THREE.Box3().setFromObject(meshes[step.part]).getCenter(tmp);
        const p = tmp.clone().project(st.camera);
        const rect = renderer.domElement.getBoundingClientRect();
        annoLabel.value = {
          x: (p.x * 0.5 + 0.5) * rect.width,
          y: (-p.y * 0.5 + 0.5) * rect.height,
          text: step.title,
        };
      } else annoLabel.value = null;
    } else annoLabel.value = null;
  }
  loop();

  // expose ro for cleanup
  (S.value as any)._ro = ro;
});

// ── Ground helpers ──────────────────────────────────────────────────────
function radialAlpha(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#bbbbbb"); g.addColorStop(1, "#000000");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); return t;
}
function cassetteTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1a1c22"; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(120,200,210,0.18)"; ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(217,72,0,0.5)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 180); ctx.lineTo(512, 180); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 332); ctx.lineTo(512, 332); ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function applyGround() {
  const st = S.value; if (!st) return;
  if (ground.value === "kraft") {
    st.groundMat.map = st.kraftTex; st.groundMat.color.set(0xcdb085);
  } else {
    st.groundMat.map = st.cassetteTex; st.groundMat.color.set(0xffffff);
  }
  st.groundMat.needsUpdate = true;
}
function setGround(g: "kraft" | "cassette") { ground.value = g; applyGround(); }

// ── Camera framing ──────────────────────────────────────────────────────
function frame(target: THREE.Vector3, radius: number) {
  const st = S.value; if (!st) return;
  const dist = Math.max(70, (radius / Math.sin((st.camera.fov * Math.PI) / 180 / 2)) * 1.25);
  const dir = new THREE.Vector3(0.9, 0.7, 1).normalize();
  const to = target.clone().add(dir.multiplyScalar(dist));
  st.tween = { from: st.camera.position.clone(), to, tFrom: st.controls.target.clone(), tTo: target.clone(), start: performance.now(), dur: 900 };
}
function partBox(part: string | null): { c: THREE.Vector3; r: number } {
  const st = S.value!;
  const box = new THREE.Box3();
  if (part && st.meshes[part]) box.setFromObject(st.meshes[part]);
  else Object.values(st.meshes).forEach((m) => box.expandByObject(m));
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  return { c, r };
}

// ── Tour ────────────────────────────────────────────────────────────────
function goToStep(i: number, instant = false) {
  if (!S.value) return;
  tourIndex.value = (i + TOUR.length) % TOUR.length;
  restoreAll();
  const step = TOUR[tourIndex.value];
  const { c, r } = partBox(step.part);
  if (instant) {
    S.value.camera.position.copy(c.clone().add(new THREE.Vector3(0.9, 0.7, 1).normalize().multiplyScalar(Math.max(120, r * 3))));
    S.value.controls.target.copy(c);
  } else frame(c, r);
}
function nextStep() { goToStep(tourIndex.value + 1); }
function prevStep() { goToStep(tourIndex.value - 1); }

// ── Customize ───────────────────────────────────────────────────────────
function enterCustomize() {
  mode.value = "customize";
  selectPart(activePart.value);
}
function enterTour() {
  mode.value = "tour";
  restoreAll();
  goToStep(tourIndex.value);
}
function restoreAll() {
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
    mat.color.set(chosen.value[name] ?? st.baseColor[name]);
    mat.needsUpdate = true;
    if (st.edges[name]) st.edges[name].visible = false;
  }
}
function selectPart(id: string) {
  activePart.value = id;
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    const isActive = name === id;
    // hidden structural bits (pcb/interior/switches) only show as ghosts, never isolated unless chosen
    if (isActive) {
      mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
      mat.color.set(chosen.value[name] ?? st.baseColor[name]);
      if (st.edges[name]) st.edges[name].visible = false;
    } else {
      mat.transparent = true; mat.opacity = 0.05; mat.depthWrite = false;
      if (st.edges[name]) st.edges[name].visible = true;
    }
    mat.needsUpdate = true;
  }
  // frame the part being customized
  const { c, r } = partBox(id);
  frame(c, r);
}
function pickColor(id: string, color: string) {
  chosen.value = { ...chosen.value, [id]: color };
  const st = S.value; if (!st) return;
  const m = st.meshes[id];
  if (m) (m.material as THREE.MeshStandardMaterial).color.set(color);
}

onBeforeUnmount(() => {
  disposed = true;
  const st = S.value; if (!st) return;
  cancelAnimationFrame(st.raf);
  (st as any)._ro?.disconnect?.();
  st.controls.dispose();
  st.renderer.dispose();
  st.renderer.domElement.remove();
});
</script>

<template>
  <div class="mx-wrap">
    <div class="mx-stage" :class="`mx-stage--${ground}`" ref="canvasWrap">
      <div v-if="loading" class="mx-overlay">Loading 3D model…</div>
      <div v-else-if="failed" class="mx-overlay">3D preview unavailable on this device.</div>
      <div
        v-if="annoLabel"
        class="mx-anno"
        :style="{ left: annoLabel.x + 'px', top: annoLabel.y + 'px' }"
      >{{ annoLabel.text }}</div>
      <div v-if="dimensions" class="mx-scale">
        <i class="ph-bold ph-ruler"></i>
        {{ Math.round(dimensions.w) }} × {{ Math.round(dimensions.d) }} × {{ Math.round(dimensions.h) }} mm
      </div>
    </div>

    <!-- Mode switch -->
    <div class="mx-modes">
      <button class="mx-mode" :class="{ active: mode === 'tour' }" @click="enterTour">
        <i class="ph-bold ph-presentation"></i> Tour
      </button>
      <button class="mx-mode" :class="{ active: mode === 'customize' }" @click="enterCustomize">
        <i class="ph-bold ph-paint-brush-broad"></i> Customise
      </button>
      <div class="mx-grounds">
        <button class="mx-gnd" :class="{ active: ground === 'kraft' }" @click="setGround('kraft')">Kraft</button>
        <button class="mx-gnd" :class="{ active: ground === 'cassette' }" @click="setGround('cassette')">Cassette</button>
      </div>
    </div>

    <!-- Tour panel -->
    <div v-if="mode === 'tour'" class="mx-panel">
      <div class="mx-panel-body">
        <div class="mx-step-count">{{ tourIndex + 1 }} / {{ TOUR.length }}</div>
        <h3 class="mx-step-title">{{ TOUR[tourIndex].title }}</h3>
        <p class="mx-step-text">{{ TOUR[tourIndex].body }}</p>
      </div>
      <div class="mx-panel-nav">
        <button class="mx-nav-btn" @click="prevStep"><i class="ph-bold ph-caret-left"></i></button>
        <button class="mx-nav-btn" @click="nextStep"><i class="ph-bold ph-caret-right"></i></button>
      </div>
    </div>

    <!-- Customize panel -->
    <div v-else class="mx-custom">
      <div class="mx-parts">
        <button
          v-for="p in PARTS"
          :key="p.id"
          class="mx-part-tab"
          :class="{ active: activePart === p.id }"
          @click="selectPart(p.id)"
        >{{ p.label }}</button>
      </div>
      <div class="mx-swatches">
        <button
          v-for="o in PARTS.find((p) => p.id === activePart)!.options"
          :key="o.color"
          class="mx-swatch"
          :class="{ active: chosen[activePart] === o.color }"
          :style="{ background: o.color }"
          :title="o.label"
          @click="pickColor(activePart, o.color)"
        ></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mx-wrap { width: 100%; }
.mx-stage {
  position: relative;
  width: 100%;
  height: 460px;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: background 0.3s;
}
.mx-stage--kraft {
  background: radial-gradient(ellipse 80% 60% at 50% 18%, #efe7d8 0%, #e0d4be 55%, #cdb79b 100%);
}
.mx-stage--cassette {
  background: radial-gradient(ellipse 80% 60% at 50% 18%, #2c2f38 0%, #20232b 55%, #14161b 100%);
}
.mx-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; color: #6b5b4a; pointer-events: none;
}
.mx-anno {
  position: absolute; transform: translate(-50%, -140%);
  background: rgba(26,26,26,0.88); color: #faf3e8;
  font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.55rem;
  border-radius: 999px; white-space: nowrap; pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.mx-scale {
  position: absolute; bottom: 10px; right: 10px;
  display: inline-flex; align-items: center; gap: 0.35rem;
  background: rgba(26,26,26,0.6); color: #faf3e8;
  font-size: 0.68rem; font-weight: 700; padding: 0.22rem 0.6rem;
  border-radius: 999px; pointer-events: none;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}

.mx-modes { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem; flex-wrap: wrap; }
.mx-mode {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.4rem 0.85rem; border-radius: 999px;
  border: 1.5px solid rgba(26,26,26,0.12); background: rgba(250,243,232,0.6);
  font-size: 0.8rem; font-weight: 700; color: #4a3d2f; cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.mx-mode:hover { border-color: rgba(26,26,26,0.3); }
.mx-mode.active { border-color: #d94800; background: #1a1a1a; color: #faf3e8; }
.mx-grounds { margin-left: auto; display: flex; gap: 0.3rem; }
.mx-gnd {
  padding: 0.35rem 0.7rem; border-radius: 999px;
  border: 1.5px solid rgba(26,26,26,0.12); background: rgba(250,243,232,0.6);
  font-size: 0.72rem; font-weight: 600; color: #4a3d2f; cursor: pointer;
}
.mx-gnd.active { border-color: #d94800; background: rgba(217,72,0,0.06); color: #1a1a1a; }

.mx-panel {
  display: flex; align-items: center; gap: 1rem; margin-top: 0.6rem;
  background: rgba(250,243,232,0.6); border: 1px solid rgba(26,26,26,0.1);
  border-radius: 0.75rem; padding: 0.85rem 1rem;
}
.mx-panel-body { flex: 1 1 0; min-width: 0; }
.mx-step-count { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b5b4a; }
.mx-step-title { font-family: "Fraunces", serif; font-weight: 700; font-size: 1.05rem; color: #1a1a1a; margin: 0.1rem 0 0.2rem; }
.mx-step-text { font-size: 0.82rem; color: #4a3d2f; line-height: 1.5; }
.mx-panel-nav { display: flex; gap: 0.4rem; flex-shrink: 0; }
.mx-nav-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1.5px solid rgba(26,26,26,0.15); background: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #1a1a1a;
  transition: border-color 0.15s, color 0.15s;
}
.mx-nav-btn:hover { border-color: #d94800; color: #d94800; }

.mx-custom { margin-top: 0.6rem; }
.mx-parts { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.6rem; }
.mx-part-tab {
  padding: 0.35rem 0.7rem; border-radius: 999px;
  border: 1.5px solid rgba(26,26,26,0.12); background: rgba(250,243,232,0.6);
  font-size: 0.74rem; font-weight: 600; color: #4a3d2f; cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.mx-part-tab:hover { border-color: rgba(26,26,26,0.3); }
.mx-part-tab.active { border-color: #d94800; background: rgba(217,72,0,0.06); color: #1a1a1a; }
.mx-swatches { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.mx-swatch {
  width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
  border: 2px solid rgba(0,0,0,0.15); transition: transform 0.12s, box-shadow 0.12s;
}
.mx-swatch:hover { transform: translateY(-2px); }
.mx-swatch.active { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #d94800; }
</style>
