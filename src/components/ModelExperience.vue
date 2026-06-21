<script setup lang="ts">
/**
 * ModelExperience - custom Three.js viewer for a multi-part product GLB.
 *
 * TOUR: scripted steps, each with its own "look":
 *   - top-down with 3D dimension lines (palm-size, 9 keys, encoder, 4 layers)
 *   - flipped, everything ghosted except the PCB (powered by RP2040)
 *   - side view with a looping keycap-press animation (hot-swap)
 * CUSTOMISE: pick a part; it stays solid + recolourable while the rest go
 *   ghost-transparent with black edges.
 *
 * Stage: a kraft (or cassette-tech) ground plane that orbits with the camera,
 * an "absurd lab" photo wrapped as a backdrop sky, studio-HDR + warm 3-point
 * lighting, AgX tone mapping.
 *
 * Needs a GLB with one mesh per part (materials named frontplate/backplate/
 * trim/keycaps/switches/knob/pcb/interior) from tools/step-colorize.mjs.
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
  dimensions?: { w: number; d: number; h: number };
}>();

// ── Tour ────────────────────────────────────────────────────────────────
interface TourStep {
  id: string; title: string; body: string;
  view: "top" | "bottom" | "side";
  isolate?: string; dims?: boolean; flip?: boolean; press?: boolean;
}
const TOUR: TourStep[] = [
  { id: "size", view: "top", dims: true,
    title: "Palm-sized", body: "Nine keys, a rotary encoder and up to four layers - in a footprint that sits under your palm." },
  { id: "pcb", view: "bottom", isolate: "pcb", flip: true,
    title: "Powered by RP2040", body: "Flip it over: an open-source RP2040 drives every key, encoder and the OLED." },
  { id: "keys", view: "side", press: true,
    title: "Hot-swappable keys", body: "MX hotswap sockets - pull a keycap, drop in a new switch, no soldering." },
];

// ── Customizer ──────────────────────────────────────────────────────────
interface PartOpt { label: string; color: string; }
interface PartCfg { id: string; label: string; options: PartOpt[]; }
const PARTS: PartCfg[] = [
  { id: "frontplate", label: "Top plate", options: [
    { label: "Cream", color: "#E7DCC2" }, { label: "White", color: "#F2EEE6" },
    { label: "Black", color: "#1D1D1F" }, { label: "Blue", color: "#1F8FD6" }, { label: "Mint", color: "#7AD6B0" } ] },
  { id: "backplate", label: "Bottom plate", options: [
    { label: "Cream", color: "#E7DCC2" }, { label: "White", color: "#F2EEE6" },
    { label: "Black", color: "#1D1D1F" }, { label: "Blue", color: "#1F8FD6" }, { label: "Mint", color: "#7AD6B0" } ] },
  { id: "trim", label: "Trim / gasket", options: [
    { label: "Orange", color: "#F2851F" }, { label: "Purple", color: "#6B4DB3" },
    { label: "Lime", color: "#B6D641" }, { label: "Pink", color: "#E7779E" }, { label: "Black", color: "#1D1D1F" } ] },
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

const mode = ref<"tour" | "customize">("tour");
const tourIndex = ref(0);
const activePart = ref(PARTS[0].id);
const ground = ref<"kraft" | "cassette">("kraft");
const chosen = ref<Record<string, string>>(Object.fromEntries(PARTS.map((p) => [p.id, p.options[0].color])));
const loading = ref(true);
const failed = ref(false);
const annos = ref<{ x: number; y: number; text: string }[]>([]);
const canvasWrap = ref<HTMLDivElement | null>(null);

const S = shallowRef<any>(null);
let disposed = false;

onMounted(() => {
  const wrap = canvasWrap.value;
  if (!wrap) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch { failed.value = true; loading.value = false; return; }

  const w = wrap.clientWidth || 800, h = wrap.clientHeight || 460;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 6000);
  camera.position.set(190, 150, 230);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 60;
  controls.maxDistance = 1000;
  controls.maxPolarAngle = Math.PI * 0.52;

  // ── Lighting: warm key + cool fill + back rim, plus HDR env ──
  const key = new THREE.DirectionalLight(0xfff2e0, 2.0);
  key.position.set(140, 240, 160); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 10; key.shadow.camera.far = 900;
  Object.assign(key.shadow.camera as THREE.OrthographicCamera, { left: -180, right: 180, top: 180, bottom: -180 });
  key.shadow.bias = -0.0004; key.shadow.radius = 6;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.5);
  fill.position.set(-160, 90, -60); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(-40, 120, -200); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  // ── Ground plane (orbits with camera) ──
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.95, metalness: 0, transparent: true, alphaMap: radialAlpha(),
  });
  const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(440, 64), groundMat);
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);

  // ── Backdrop "sky" (lab photo wrapped on a cylinder) ──
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: true, color: 0x9a9a9a });
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(1500, 1500, 1700, 48, 1, true), skyMat);
  sky.position.y = 500; scene.add(sky);

  S.value = { renderer, scene, camera, controls, key, fill, rim,
    groundMat, sky, skyMat, meshes: {}, edges: {}, baseColor: {},
    kraftTex: null, cassetteTex: cassetteTexture(), labTex: null,
    pivot: null, dims: null, flipTarget: 0, keycapBaseY: 0, pressActive: false,
    tween: null, raf: 0 };

  // textures
  const tl = new THREE.TextureLoader();
  tl.load("/images/kraft-paper.jpg", (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; S.value.kraftTex = t; if (ground.value === "kraft") applyGround(); });
  tl.load("/images/projects/workdesk.jpg", (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); S.value.labTex = t; applyGround(); });
  applyGround();

  // HDR env (clean lighting)
  new RGBELoader().load("/hdr/studio.hdr", (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose(); pmrem.dispose();
  });

  // ── Load model ──
  const draco = new DRACOLoader().setDecoderPath("/draco/");
  new GLTFLoader().setDRACOLoader(draco).load(props.src, (gltf) => {
    if (disposed) return;
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const g = m.geometry as THREE.BufferGeometry;
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      const name = (((m.material as THREE.MeshStandardMaterial)?.name || m.name || "").replace(/-Mesh$/, "")).toLowerCase();
      const std = m.material as THREE.MeshStandardMaterial;
      std.roughness = 0.6; std.metalness = 0.0; std.envMapIntensity = 0.9;
      m.castShadow = true; m.receiveShadow = true;
      S.value.meshes[name] = m;
      S.value.baseColor[name] = std.color.clone();
      if (name !== "interior") {
        const el = new THREE.LineSegments(new THREE.EdgesGeometry(g, 32), new THREE.LineBasicMaterial({ color: 0x141414 }));
        el.visible = false; m.add(el); S.value.edges[name] = el;
      }
    });

    // center x/z, rest on ground; pivot at vertical centre for flipping
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x; root.position.z -= center.z; root.position.y -= box.min.y;
    const pivot = new THREE.Group(); pivot.position.y = size.y / 2;
    root.position.y -= size.y / 2; pivot.add(root); scene.add(pivot);
    S.value.pivot = pivot;
    S.value.modelSize = size;
    if (S.value.meshes.keycaps) S.value.keycapBaseY = S.value.meshes.keycaps.position.y;

    // dimension lines (top-down)
    S.value.dims = buildDims(size);
    scene.add(S.value.dims);

    applyStep(0, true);
    loading.value = false;
  }, undefined, () => { failed.value = true; loading.value = false; });

  // resize
  const ro = new ResizeObserver(() => {
    if (!S.value) return;
    const ww = wrap.clientWidth, hh = wrap.clientHeight; if (!ww || !hh) return;
    S.value.camera.aspect = ww / hh; S.value.camera.updateProjectionMatrix(); S.value.renderer.setSize(ww, hh);
  });
  ro.observe(wrap); S.value._ro = ro;

  // ── render loop ──
  const v = new THREE.Vector3();
  function loop() {
    if (!S.value || disposed) return;
    S.value.raf = requestAnimationFrame(loop);
    const st = S.value;
    // camera tween
    if (st.tween) {
      const k = Math.min(1, (performance.now() - st.tween.start) / st.tween.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      st.camera.position.lerpVectors(st.tween.from, st.tween.to, e);
      st.controls.target.lerpVectors(st.tween.tFrom, st.tween.tTo, e);
      if (k >= 1) st.tween = null;
    }
    // flip damping
    if (st.pivot) st.pivot.rotation.x += (st.flipTarget - st.pivot.rotation.x) * 0.12;
    // keycap press loop
    if (st.meshes.keycaps) {
      const kc = st.meshes.keycaps;
      if (st.pressActive) {
        const p = (Math.sin(performance.now() / 320) * 0.5 + 0.5) ** 2; // 0..1 dwell at top
        kc.position.y = st.keycapBaseY - p * 2.2;
      } else kc.position.y += (st.keycapBaseY - kc.position.y) * 0.2;
    }
    st.controls.update();
    st.renderer.render(st.scene, st.camera);
    updateAnnos(v);
  }
  loop();
});

// ── ground / sky ──
function radialAlpha(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!; const g = x.createRadialGradient(128, 128, 18, 128, 128, 128);
  g.addColorStop(0, "#fff"); g.addColorStop(0.72, "#bbb"); g.addColorStop(1, "#000");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
function cassetteTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d")!;
  x.fillStyle = "#1a1c22"; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = "rgba(120,200,210,0.18)"; x.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = "rgba(217,72,0,0.5)"; x.lineWidth = 4;
  x.beginPath(); x.moveTo(0, 180); x.lineTo(512, 180); x.stroke();
  x.beginPath(); x.moveTo(0, 332); x.lineTo(512, 332); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function applyGround() {
  const st = S.value; if (!st) return;
  if (ground.value === "kraft") {
    st.groundMat.map = st.kraftTex; st.groundMat.color.set(0xcdb085);
    if (st.labTex) { st.skyMat.map = st.labTex; st.skyMat.color.set(0x9a9a9a); st.sky.visible = true; }
  } else {
    st.groundMat.map = st.cassetteTex; st.groundMat.color.set(0xffffff);
    st.skyMat.map = null; st.sky.visible = false;
  }
  st.groundMat.needsUpdate = true; st.skyMat.needsUpdate = true;
}
function setGround(g: "kraft" | "cassette") { ground.value = g; applyGround(); }

// ── dimension lines ──
function buildDims(size: THREE.Vector3): THREE.Group {
  const grp = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  const hw = size.x / 2, hd = size.z / 2, y = 0.6, m = 14, tk = 5;
  const seg = (pts: number[][]) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return new THREE.Line(g, mat);
  };
  // width line (+ end ticks) along X at front
  grp.add(seg([[-hw, y, hd + m], [hw, y, hd + m]]));
  grp.add(seg([[-hw, y, hd + m - tk], [-hw, y, hd + m + tk]]));
  grp.add(seg([[hw, y, hd + m - tk], [hw, y, hd + m + tk]]));
  // depth line along Z at left
  grp.add(seg([[-hw - m, y, -hd], [-hw - m, y, hd]]));
  grp.add(seg([[-hw - m - tk, y, -hd], [-hw - m + tk, y, -hd]]));
  grp.add(seg([[-hw - m - tk, y, hd], [-hw - m + tk, y, hd]]));
  grp.visible = false;
  grp.userData = { widthAt: new THREE.Vector3(0, y, hd + m), depthAt: new THREE.Vector3(-hw - m, y, 0) };
  return grp;
}

// ── annotations (projected each frame) ──
function updateAnnos(v: THREE.Vector3) {
  const st = S.value; if (!st) { annos.value = []; return; }
  const out: { x: number; y: number; text: string }[] = [];
  const rect = st.renderer.domElement.getBoundingClientRect();
  const push = (p: THREE.Vector3, text: string) => {
    const q = p.clone().project(st.camera);
    if (q.z > 1) return;
    out.push({ x: (q.x * 0.5 + 0.5) * rect.width, y: (-q.y * 0.5 + 0.5) * rect.height, text });
  };
  if (mode.value === "tour") {
    const step = TOUR[tourIndex.value];
    if (step.dims && st.dims) {
      const d = props.dimensions;
      push(st.dims.userData.widthAt, d ? `${Math.round(d.w)} mm` : "width");
      push(st.dims.userData.depthAt, d ? `${Math.round(d.d)} mm` : "depth");
    }
    if (step.isolate && st.meshes[step.isolate]) {
      new THREE.Box3().setFromObject(st.meshes[step.isolate]).getCenter(v);
      push(v, "RP2040");
    }
    if (step.press && st.meshes.keycaps) {
      new THREE.Box3().setFromObject(st.meshes.keycaps).getCenter(v);
      push(v, "Hot-swap");
    }
  }
  annos.value = out;
}

// ── camera framing ──
function frame(center: THREE.Vector3, r: number, view: string) {
  const st = S.value; if (!st) return;
  const dir = view === "top" ? new THREE.Vector3(0.02, 1, 0.05)
    : view === "side" ? new THREE.Vector3(1, 0.22, 0.45)
    : new THREE.Vector3(0.65, 0.6, 1);
  dir.normalize();
  const f = view === "top" ? 1.05 : 1.3;
  const dist = Math.max(70, (r / Math.sin((st.camera.fov * Math.PI) / 180 / 2)) * f);
  st.tween = { from: st.camera.position.clone(), to: center.clone().add(dir.multiplyScalar(dist)),
    tFrom: st.controls.target.clone(), tTo: center.clone(), start: performance.now(), dur: 950 };
}
function modelCenter(): { c: THREE.Vector3; r: number } {
  const st = S.value; const box = new THREE.Box3();
  Object.values(st.meshes).forEach((m: any) => box.expandByObject(m));
  return { c: box.getCenter(new THREE.Vector3()), r: box.getSize(new THREE.Vector3()).length() / 2 };
}
function partCenter(part: string): { c: THREE.Vector3; r: number } {
  const st = S.value; const box = new THREE.Box3();
  if (st.meshes[part]) box.setFromObject(st.meshes[part]); else return modelCenter();
  return { c: box.getCenter(new THREE.Vector3()), r: Math.max(box.getSize(new THREE.Vector3()).length() / 2, 18) };
}

// ── apply a tour step ──
function applyStep(i: number, instant = false) {
  const st = S.value; if (!st) return;
  tourIndex.value = (i + TOUR.length) % TOUR.length;
  const step = TOUR[tourIndex.value];
  // isolation
  if (step.isolate) isolate(step.isolate, false);
  else restoreAll();
  // dims
  if (st.dims) st.dims.visible = !!step.dims;
  // flip
  st.flipTarget = step.flip ? Math.PI : 0;
  // press
  st.pressActive = !!step.press;
  // camera
  const { c, r } = modelCenter();
  if (instant) {
    const dir = (step.view === "top" ? new THREE.Vector3(0.02, 1, 0.05) : step.view === "side" ? new THREE.Vector3(1, 0.22, 0.45) : new THREE.Vector3(0.65, 0.6, 1)).normalize();
    st.camera.position.copy(c.clone().add(dir.multiplyScalar(Math.max(160, r * 2.6))));
    st.controls.target.copy(c);
  } else frame(c, r, step.view);
}
function nextStep() { applyStep(tourIndex.value + 1); }
function prevStep() { applyStep(tourIndex.value - 1); }

// ── isolation / colour ──
function restoreAll() {
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
    mat.color.set(chosen.value[name] ?? st.baseColor[name]); mat.needsUpdate = true;
    if (st.edges[name]) st.edges[name].visible = false;
  }
}
function isolate(id: string, frameIt = true) {
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (name === id) {
      mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
      mat.color.set(chosen.value[name] ?? st.baseColor[name]);
      if (st.edges[name]) st.edges[name].visible = false;
    } else {
      mat.transparent = true; mat.opacity = 0.045; mat.depthWrite = false;
      if (st.edges[name]) st.edges[name].visible = true;
    }
    mat.needsUpdate = true;
  }
  if (frameIt) { const { c, r } = partCenter(id); frame(c, r, "side"); }
}

function enterTour() { mode.value = "tour"; if (S.value) { S.value.flipTarget = 0; S.value.pressActive = false; } applyStep(tourIndex.value); }
function enterCustomize() {
  mode.value = "customize";
  if (S.value) { S.value.flipTarget = 0; S.value.pressActive = false; if (S.value.dims) S.value.dims.visible = false; }
  selectPart(activePart.value);
}
function selectPart(id: string) { activePart.value = id; isolate(id, true); }
function pickColor(id: string, color: string) {
  chosen.value = { ...chosen.value, [id]: color };
  const m = S.value?.meshes[id]; if (m) (m.material as THREE.MeshStandardMaterial).color.set(color);
}

onBeforeUnmount(() => {
  disposed = true; const st = S.value; if (!st) return;
  cancelAnimationFrame(st.raf); st._ro?.disconnect?.();
  st.controls.dispose(); st.renderer.dispose(); st.renderer.domElement.remove();
});
</script>

<template>
  <div class="mx-wrap">
    <div class="mx-stage" :class="`mx-stage--${ground}`" ref="canvasWrap">
      <div v-if="loading" class="mx-overlay">Loading 3D model…</div>
      <div v-else-if="failed" class="mx-overlay">3D preview unavailable on this device.</div>
      <div v-for="(a, i) in annos" :key="i" class="mx-anno" :style="{ left: a.x + 'px', top: a.y + 'px' }">{{ a.text }}</div>
      <div v-if="dimensions" class="mx-scale">
        <i class="ph-bold ph-ruler"></i>
        {{ Math.round(dimensions.w) }} × {{ Math.round(dimensions.d) }} × {{ Math.round(dimensions.h) }} mm
      </div>
    </div>

    <div class="mx-modes">
      <button class="mx-mode" :class="{ active: mode === 'tour' }" @click="enterTour"><i class="ph-bold ph-presentation"></i> Tour</button>
      <button class="mx-mode" :class="{ active: mode === 'customize' }" @click="enterCustomize"><i class="ph-bold ph-paint-brush-broad"></i> Customise</button>
      <div class="mx-grounds">
        <button class="mx-gnd" :class="{ active: ground === 'kraft' }" @click="setGround('kraft')">Kraft</button>
        <button class="mx-gnd" :class="{ active: ground === 'cassette' }" @click="setGround('cassette')">Cassette</button>
      </div>
    </div>

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

    <div v-else class="mx-custom">
      <div class="mx-parts">
        <button v-for="p in PARTS" :key="p.id" class="mx-part-tab" :class="{ active: activePart === p.id }" @click="selectPart(p.id)">{{ p.label }}</button>
      </div>
      <div class="mx-swatches">
        <button v-for="o in PARTS.find((p) => p.id === activePart)!.options" :key="o.color"
          class="mx-swatch" :class="{ active: chosen[activePart] === o.color }"
          :style="{ background: o.color }" :title="o.label" @click="pickColor(activePart, o.color)"></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mx-wrap { width: 100%; }
.mx-stage { position: relative; width: 100%; height: 460px; border-radius: 0.75rem; overflow: hidden; transition: background 0.3s; }
.mx-stage--kraft { background: radial-gradient(ellipse 90% 70% at 50% 8%, #efe7d8 0%, #e0d4be 50%, #cdb79b 100%); }
.mx-stage--cassette { background: radial-gradient(ellipse 90% 70% at 50% 8%, #2c2f38 0%, #20232b 55%, #14161b 100%); }
.mx-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: #6b5b4a; pointer-events: none; }
.mx-anno { position: absolute; transform: translate(-50%, -150%); background: rgba(26,26,26,0.88); color: #faf3e8; font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.5rem; border-radius: 999px; white-space: nowrap; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.mx-scale { position: absolute; bottom: 10px; right: 10px; display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(26,26,26,0.6); color: #faf3e8; font-size: 0.68rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 999px; pointer-events: none; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.mx-modes { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem; flex-wrap: wrap; }
.mx-mode { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.85rem; border-radius: 999px; border: 1.5px solid rgba(26,26,26,0.12); background: rgba(250,243,232,0.6); font-size: 0.8rem; font-weight: 700; color: #4a3d2f; cursor: pointer; transition: all 0.15s; }
.mx-mode:hover { border-color: rgba(26,26,26,0.3); }
.mx-mode.active { border-color: #d94800; background: #1a1a1a; color: #faf3e8; }
.mx-grounds { margin-left: auto; display: flex; gap: 0.3rem; }
.mx-gnd { padding: 0.35rem 0.7rem; border-radius: 999px; border: 1.5px solid rgba(26,26,26,0.12); background: rgba(250,243,232,0.6); font-size: 0.72rem; font-weight: 600; color: #4a3d2f; cursor: pointer; }
.mx-gnd.active { border-color: #d94800; background: rgba(217,72,0,0.06); color: #1a1a1a; }
.mx-panel { display: flex; align-items: center; gap: 1rem; margin-top: 0.6rem; background: rgba(250,243,232,0.6); border: 1px solid rgba(26,26,26,0.1); border-radius: 0.75rem; padding: 0.85rem 1rem; }
.mx-panel-body { flex: 1 1 0; min-width: 0; }
.mx-step-count { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b5b4a; }
.mx-step-title { font-family: "Fraunces", serif; font-weight: 700; font-size: 1.05rem; color: #1a1a1a; margin: 0.1rem 0 0.2rem; }
.mx-step-text { font-size: 0.82rem; color: #4a3d2f; line-height: 1.5; }
.mx-panel-nav { display: flex; gap: 0.4rem; flex-shrink: 0; }
.mx-nav-btn { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid rgba(26,26,26,0.15); background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #1a1a1a; transition: all 0.15s; }
.mx-nav-btn:hover { border-color: #d94800; color: #d94800; }
.mx-custom { margin-top: 0.6rem; }
.mx-parts { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.6rem; }
.mx-part-tab { padding: 0.35rem 0.7rem; border-radius: 999px; border: 1.5px solid rgba(26,26,26,0.12); background: rgba(250,243,232,0.6); font-size: 0.74rem; font-weight: 600; color: #4a3d2f; cursor: pointer; transition: all 0.15s; }
.mx-part-tab:hover { border-color: rgba(26,26,26,0.3); }
.mx-part-tab.active { border-color: #d94800; background: rgba(217,72,0,0.06); color: #1a1a1a; }
.mx-swatches { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.mx-swatch { width: 30px; height: 30px; border-radius: 8px; cursor: pointer; border: 2px solid rgba(0,0,0,0.15); transition: transform 0.12s, box-shadow 0.12s; }
.mx-swatch:hover { transform: translateY(-2px); }
.mx-swatch.active { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #d94800; }
</style>
