<script setup lang="ts">
/**
 * ModelExperience - custom Three.js viewer for a multi-part product GLB.
 *
 * TOUR (steps, each with its own staging):
 *   1. top-down + 3D dimension lines (palm-size, 9 keys, encoder, 4 layers)
 *   2. ghost everything but the PCB, zoom in (open-source, hot-swap)
 *   3. switches drop-insert into the PCB on a loop
 *   4. keycaps press on a loop
 * CUSTOMISE: pick a part; it stays solid + recolourable, the rest go
 *   ghost-transparent with black edges.
 *
 * Stage: a cassette-tech ground plane that orbits with the camera, dramatic
 * 3-point lighting over a studio HDR, dark fog for depth, and a subtle bloom
 * pass. A debug panel reports live camera angles.
 */
import { ref, shallowRef, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const props = defineProps<{
  src: string;
  alt?: string;
  dimensions?: { w: number; d: number; h: number };
}>();

// ── Tour ────────────────────────────────────────────────────────────────
interface TourStep {
  id: string; title: string; body: string;
  view: "top" | "front" | "side";
  show?: string[];        // parts to keep solid; others ghost + edges
  dims?: boolean; insert?: boolean; press?: boolean;
}
const TOUR: TourStep[] = [
  { id: "size", view: "top", dims: true,
    title: "Palm-sized", body: "Nine keys, a rotary encoder and up to four layers - in a footprint that sits under your palm." },
  { id: "pcb", view: "front", show: ["pcb"],
    title: "Open-source PCB", body: "Everything ghosts away to the open-source PCB - hot-swap sockets, RP2040, OLED, all public." },
  { id: "insert", view: "front", show: ["pcb", "switches"], insert: true,
    title: "Drop-in switches", body: "MX switches drop straight into the hot-swap sockets. No soldering required." },
  { id: "keys", view: "side", press: true,
    title: "Cap it and type", body: "Pop on the keycaps and go - tactile, clicky or silent, your call." },
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
const chosen = ref<Record<string, string>>(Object.fromEntries(PARTS.map((p) => [p.id, p.options[0].color])));
const loading = ref(true);
const failed = ref(false);
const annos = ref<{ x: number; y: number; text: string }[]>([]);
const debugOn = ref(false);
const dbg = ref({ az: 0, polar: 0, dist: 0, px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0 });
const canvasWrap = ref<HTMLDivElement | null>(null);

const S = shallowRef<any>(null);
let disposed = false;

onMounted(() => {
  const wrap = canvasWrap.value;
  if (!wrap) return;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch { failed.value = true; loading.value = false; return; }

  const w = wrap.clientWidth || 800, h = wrap.clientHeight || 460;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12141a);
  scene.fog = new THREE.FogExp2(0x0f1116, 0.0016); // depth / "blurred" falloff

  const camera = new THREE.PerspectiveCamera(38, w / h, 0.5, 8000);
  camera.position.set(190, 150, 230);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 60; controls.maxDistance = 1000;
  controls.maxPolarAngle = Math.PI * 0.52;

  // ── Dramatic lighting: strong warm key, low cool fill, teal+orange rims ──
  const key = new THREE.DirectionalLight(0xfff1dc, 3.2);
  key.position.set(150, 300, 170); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 20; key.shadow.camera.far = 1100; key.shadow.bias = -0.0004; key.shadow.radius = 9;
  Object.assign(key.shadow.camera as THREE.OrthographicCamera, { left: -200, right: 200, top: 200, bottom: -200 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.35); fill.position.set(-160, 70, -40); scene.add(fill);
  const rimA = new THREE.DirectionalLight(0xff7a2f, 1.1); rimA.position.set(120, 40, -200); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0x39d0d8, 0.8); rimB.position.set(-150, 30, -160); scene.add(rimB);
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));

  // ── Cassette-tech ground (orbits with camera) ──
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.85, metalness: 0.1, map: cassetteTexture(),
    transparent: true, alphaMap: radialAlpha(),
  });
  const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(520, 64), groundMat);
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);

  // ── Postprocessing: render -> subtle bloom -> output (tone map + sRGB) ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  S.value = { renderer, composer, bloom, scene, camera, controls,
    meshes: {}, edges: {}, baseColor: {},
    switchBaseY: 0, keycapBaseY: 0, insertActive: false, pressActive: false,
    tween: null, raf: 0 };

  // HDR env (fills the PBR reflections)
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
      std.roughness = 0.55; std.metalness = 0.05; std.envMapIntensity = 1.1;
      m.castShadow = true; m.receiveShadow = true;
      S.value.meshes[name] = m;
      S.value.baseColor[name] = std.color.clone();
      if (name !== "interior") {
        const el = new THREE.LineSegments(new THREE.EdgesGeometry(g, 32), new THREE.LineBasicMaterial({ color: 0x0c0c0c }));
        el.visible = false; m.add(el); S.value.edges[name] = el;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x; root.position.z -= center.z; root.position.y -= box.min.y;
    scene.add(root);
    S.value.root = root; S.value.modelSize = size;
    if (S.value.meshes.switches) S.value.switchBaseY = S.value.meshes.switches.position.y;
    if (S.value.meshes.keycaps) S.value.keycapBaseY = S.value.meshes.keycaps.position.y;

    S.value.dims = buildDims(size); scene.add(S.value.dims);
    applyStep(0, true);
    loading.value = false;
  }, undefined, () => { failed.value = true; loading.value = false; });

  const ro = new ResizeObserver(() => {
    if (!S.value) return;
    const ww = wrap.clientWidth, hh = wrap.clientHeight; if (!ww || !hh) return;
    S.value.camera.aspect = ww / hh; S.value.camera.updateProjectionMatrix();
    S.value.renderer.setSize(ww, hh); S.value.composer.setSize(ww, hh);
  });
  ro.observe(wrap); S.value._ro = ro;

  // ── render loop ──
  const v = new THREE.Vector3(), sph = new THREE.Spherical(), off = new THREE.Vector3();
  function loop() {
    if (!S.value || disposed) return;
    S.value.raf = requestAnimationFrame(loop);
    const st = S.value;
    if (st.tween) {
      const k = Math.min(1, (performance.now() - st.tween.start) / st.tween.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      st.camera.position.lerpVectors(st.tween.from, st.tween.to, e);
      st.controls.target.lerpVectors(st.tween.tFrom, st.tween.tTo, e);
      if (k >= 1) st.tween = null;
    }
    // switch drop-insert loop
    if (st.meshes.switches) {
      const sw = st.meshes.switches;
      if (st.insertActive) {
        const t = (performance.now() % 1600) / 1600;
        const e = 1 - Math.pow(1 - t, 3);
        sw.position.y = st.switchBaseY + 16 * (1 - e);
      } else sw.position.y += (st.switchBaseY - sw.position.y) * 0.2;
    }
    // keycap press loop
    if (st.meshes.keycaps) {
      const kc = st.meshes.keycaps;
      if (st.pressActive) {
        const p = (Math.sin(performance.now() / 320) * 0.5 + 0.5) ** 2;
        kc.position.y = st.keycapBaseY - p * 2.4;
      } else kc.position.y += (st.keycapBaseY - kc.position.y) * 0.2;
    }
    st.controls.update();
    st.composer.render();
    updateAnnos(v);
    // debug readout
    if (debugOn.value) {
      off.copy(st.camera.position).sub(st.controls.target); sph.setFromVector3(off);
      dbg.value = {
        az: +THREE.MathUtils.radToDeg(sph.theta).toFixed(1),
        polar: +THREE.MathUtils.radToDeg(sph.phi).toFixed(1),
        dist: +sph.radius.toFixed(0),
        px: +st.camera.position.x.toFixed(1), py: +st.camera.position.y.toFixed(1), pz: +st.camera.position.z.toFixed(1),
        tx: +st.controls.target.x.toFixed(1), ty: +st.controls.target.y.toFixed(1), tz: +st.controls.target.z.toFixed(1),
      };
    }
  }
  loop();
});

// ── textures ──
function radialAlpha(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d")!; const g = x.createRadialGradient(128, 128, 16, 128, 128, 128);
  g.addColorStop(0, "#fff"); g.addColorStop(0.65, "#888"); g.addColorStop(1, "#000");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
function cassetteTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d")!;
  x.fillStyle = "#161922"; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = "rgba(120,205,215,0.16)"; x.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = "rgba(255,108,30,0.7)"; x.lineWidth = 5;
  x.beginPath(); x.moveTo(0, 188); x.lineTo(512, 188); x.stroke();
  x.beginPath(); x.moveTo(0, 326); x.lineTo(512, 326); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── dimension lines ──
function buildDims(size: THREE.Vector3): THREE.Group {
  const grp = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0xf2f0ea });
  const hw = size.x / 2, hd = size.z / 2, y = 0.6, m = 16, tk = 6;
  const seg = (pts: number[][]) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), mat);
  grp.add(seg([[-hw, y, hd + m], [hw, y, hd + m]]));
  grp.add(seg([[-hw, y, hd + m - tk], [-hw, y, hd + m + tk]]));
  grp.add(seg([[hw, y, hd + m - tk], [hw, y, hd + m + tk]]));
  grp.add(seg([[-hw - m, y, -hd], [-hw - m, y, hd]]));
  grp.add(seg([[-hw - m - tk, y, -hd], [-hw - m + tk, y, -hd]]));
  grp.add(seg([[-hw - m - tk, y, hd], [-hw - m + tk, y, hd]]));
  grp.visible = false;
  grp.userData = { widthAt: new THREE.Vector3(0, y, hd + m), depthAt: new THREE.Vector3(-hw - m, y, 0) };
  return grp;
}

// ── annotations ──
function updateAnnos(v: THREE.Vector3) {
  const st = S.value; if (!st) { annos.value = []; return; }
  const out: { x: number; y: number; text: string }[] = [];
  const rect = st.renderer.domElement.getBoundingClientRect();
  const push = (p: THREE.Vector3, text: string) => {
    const q = p.clone().project(st.camera); if (q.z > 1) return;
    out.push({ x: (q.x * 0.5 + 0.5) * rect.width, y: (-q.y * 0.5 + 0.5) * rect.height, text });
  };
  if (mode.value === "tour") {
    const step = TOUR[tourIndex.value];
    if (step.dims && st.dims) {
      const d = props.dimensions;
      push(st.dims.userData.widthAt, d ? `${Math.round(d.w)} mm` : "width");
      push(st.dims.userData.depthAt, d ? `${Math.round(d.d)} mm` : "depth");
    }
    if (step.id === "pcb" && st.meshes.pcb) { new THREE.Box3().setFromObject(st.meshes.pcb).getCenter(v); push(v, "Hot-swap PCB"); }
    if (step.insert && st.meshes.switches) { new THREE.Box3().setFromObject(st.meshes.switches).getCenter(v); push(v, "Drop-in"); }
    if (step.press && st.meshes.keycaps) { new THREE.Box3().setFromObject(st.meshes.keycaps).getCenter(v); push(v, "Press"); }
  }
  annos.value = out;
}

// ── camera framing ──
function dirFor(view: string): THREE.Vector3 {
  return (view === "top" ? new THREE.Vector3(0.02, 1, 0.05)
    : view === "side" ? new THREE.Vector3(1, 0.22, 0.45)
    : new THREE.Vector3(0.55, 0.5, 1)).normalize();
}
function frame(center: THREE.Vector3, r: number, view: string) {
  const st = S.value; if (!st) return;
  const f = view === "top" ? 1.05 : view === "front" ? 1.15 : 1.3;
  const dist = Math.max(70, (r / Math.sin((st.camera.fov * Math.PI) / 180 / 2)) * f);
  st.tween = { from: st.camera.position.clone(), to: center.clone().add(dirFor(view).multiplyScalar(dist)),
    tFrom: st.controls.target.clone(), tTo: center.clone(), start: performance.now(), dur: 950 };
}
function boxOf(parts?: string[]): { c: THREE.Vector3; r: number } {
  const st = S.value; const box = new THREE.Box3();
  const list = parts && parts.length ? parts.map((p) => st.meshes[p]).filter(Boolean) : Object.values(st.meshes);
  list.forEach((m: any) => box.expandByObject(m));
  return { c: box.getCenter(new THREE.Vector3()), r: Math.max(box.getSize(new THREE.Vector3()).length() / 2, 18) };
}

// ── steps / isolation ──
function applyStep(i: number, instant = false) {
  const st = S.value; if (!st) return;
  tourIndex.value = (i + TOUR.length) % TOUR.length;
  const step = TOUR[tourIndex.value];
  if (step.show) showOnly(step.show); else restoreAll();
  if (st.dims) st.dims.visible = !!step.dims;
  st.insertActive = !!step.insert;
  st.pressActive = !!step.press;
  const { c, r } = boxOf(step.show);
  if (instant) {
    st.camera.position.copy(c.clone().add(dirFor(step.view).multiplyScalar(Math.max(150, r * 2.6))));
    st.controls.target.copy(c);
  } else frame(c, r, step.view);
}
function nextStep() { applyStep(tourIndex.value + 1); }
function prevStep() { applyStep(tourIndex.value - 1); }

function restoreAll() {
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
    mat.color.set(chosen.value[name] ?? st.baseColor[name]); mat.needsUpdate = true;
    if (st.edges[name]) st.edges[name].visible = false;
  }
}
function showOnly(ids: string[]) {
  const st = S.value; if (!st) return;
  const set = new Set(ids);
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (set.has(name)) {
      mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
      mat.color.set(chosen.value[name] ?? st.baseColor[name]);
      if (st.edges[name]) st.edges[name].visible = false;
    } else {
      mat.transparent = true; mat.opacity = 0.04; mat.depthWrite = false;
      if (st.edges[name]) st.edges[name].visible = true;
    }
    mat.needsUpdate = true;
  }
}

function enterTour() { mode.value = "tour"; if (S.value) { S.value.insertActive = false; S.value.pressActive = false; } applyStep(tourIndex.value); }
function enterCustomize() {
  mode.value = "customize";
  if (S.value) { S.value.insertActive = false; S.value.pressActive = false; if (S.value.dims) S.value.dims.visible = false; }
  selectPart(activePart.value);
}
function selectPart(id: string) {
  activePart.value = id; showOnly([id]);
  const { c, r } = boxOf([id]); frame(c, r, "front");
}
function pickColor(id: string, color: string) {
  chosen.value = { ...chosen.value, [id]: color };
  const m = S.value?.meshes[id]; if (m) (m.material as THREE.MeshStandardMaterial).color.set(color);
}

// ── debug ──
function copyFrame() {
  const d = dbg.value;
  const snippet = `az ${d.az}°, polar ${d.polar}°, dist ${d.dist} | pos [${d.px}, ${d.py}, ${d.pz}] target [${d.tx}, ${d.ty}, ${d.tz}]`;
  navigator.clipboard?.writeText(snippet);
}

onBeforeUnmount(() => {
  disposed = true; const st = S.value; if (!st) return;
  cancelAnimationFrame(st.raf); st._ro?.disconnect?.();
  st.controls.dispose(); st.composer.dispose?.(); st.renderer.dispose(); st.renderer.domElement.remove();
});
</script>

<template>
  <div class="mx-wrap">
    <div class="mx-stage" ref="canvasWrap">
      <div class="mx-vignette"></div>
      <div v-if="loading" class="mx-overlay">Loading 3D model…</div>
      <div v-else-if="failed" class="mx-overlay">3D preview unavailable on this device.</div>

      <!-- projected annotations -->
      <div v-for="(a, i) in annos" :key="i" class="mx-anno" :style="{ left: a.x + 'px', top: a.y + 'px' }">{{ a.text }}</div>

      <!-- top-left: mode toggle -->
      <div class="mx-ui mx-ui--tl">
        <button class="mx-mode" :class="{ active: mode === 'tour' }" @click="enterTour"><i class="ph-bold ph-presentation"></i> Tour</button>
        <button class="mx-mode" :class="{ active: mode === 'customize' }" @click="enterCustomize"><i class="ph-bold ph-paint-brush-broad"></i> Customise</button>
      </div>

      <!-- top-right: debug toggle -->
      <div class="mx-ui mx-ui--tr">
        <button class="mx-mini" :class="{ active: debugOn }" @click="debugOn = !debugOn" title="Camera debug"><i class="ph-bold ph-bug"></i></button>
      </div>

      <!-- scale chip -->
      <div v-if="dimensions" class="mx-scale">
        <i class="ph-bold ph-ruler"></i> {{ Math.round(dimensions.w) }} × {{ Math.round(dimensions.d) }} × {{ Math.round(dimensions.h) }} mm
      </div>

      <!-- bottom overlay: tour text + nav, or customise controls -->
      <div v-if="mode === 'tour'" class="mx-ui mx-ui--bottom">
        <div class="mx-step">
          <div class="mx-step-count">{{ tourIndex + 1 }} / {{ TOUR.length }}</div>
          <h3 class="mx-step-title">{{ TOUR[tourIndex].title }}</h3>
          <p class="mx-step-text">{{ TOUR[tourIndex].body }}</p>
        </div>
        <div class="mx-nav">
          <button class="mx-nav-btn" @click="prevStep"><i class="ph-bold ph-caret-left"></i></button>
          <button class="mx-nav-btn" @click="nextStep"><i class="ph-bold ph-caret-right"></i></button>
        </div>
      </div>

      <div v-else class="mx-ui mx-ui--bottom mx-ui--custom">
        <div class="mx-parts">
          <button v-for="p in PARTS" :key="p.id" class="mx-part-tab" :class="{ active: activePart === p.id }" @click="selectPart(p.id)">{{ p.label }}</button>
        </div>
        <div class="mx-swatches">
          <button v-for="o in PARTS.find((p) => p.id === activePart)!.options" :key="o.color"
            class="mx-swatch" :class="{ active: chosen[activePart] === o.color }"
            :style="{ background: o.color }" :title="o.label" @click="pickColor(activePart, o.color)"></button>
        </div>
      </div>

      <!-- debug sidebar -->
      <div v-if="debugOn" class="mx-debug">
        <div class="mx-debug-h">Camera <button class="mx-debug-x" @click="debugOn = false">×</button></div>
        <dl>
          <div><dt>azimuth</dt><dd>{{ dbg.az }}°</dd></div>
          <div><dt>polar</dt><dd>{{ dbg.polar }}°</dd></div>
          <div><dt>distance</dt><dd>{{ dbg.dist }}</dd></div>
          <div><dt>pos</dt><dd>{{ dbg.px }}, {{ dbg.py }}, {{ dbg.pz }}</dd></div>
          <div><dt>target</dt><dd>{{ dbg.tx }}, {{ dbg.ty }}, {{ dbg.tz }}</dd></div>
        </dl>
        <button class="mx-debug-copy" @click="copyFrame"><i class="ph-bold ph-copy"></i> Copy frame</button>
        <p class="mx-debug-hint">Orbit to a nice angle, hit copy, paste it to me for that step.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mx-wrap { width: 100%; }
.mx-stage { position: relative; width: 100%; height: 480px; border-radius: 0.75rem; overflow: hidden; background: #12141a; }
.mx-vignette { position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background: radial-gradient(ellipse 75% 75% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%); }
.mx-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: #cbb89a; pointer-events: none; z-index: 3; }
.mx-anno { position: absolute; transform: translate(-50%, -150%); z-index: 3; background: rgba(10,10,12,0.9); color: #faf3e8; font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.5rem; border-radius: 999px; white-space: nowrap; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.mx-scale { position: absolute; bottom: 10px; right: 10px; z-index: 4; display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(10,10,12,0.55); color: #faf3e8; font-size: 0.66rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 999px; pointer-events: none; backdrop-filter: blur(6px); }

.mx-ui { position: absolute; z-index: 4; }
.mx-ui--tl { top: 10px; left: 10px; display: flex; gap: 0.35rem; }
.mx-ui--tr { top: 10px; right: 10px; }
.mx-ui--bottom { left: 10px; right: 10px; bottom: 10px; display: flex; align-items: flex-end; justify-content: space-between; gap: 0.75rem; }

.mx-mode { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.8rem; border-radius: 999px; border: 1.5px solid rgba(255,255,255,0.16); background: rgba(10,10,12,0.55); color: #f3ece0; font-size: 0.78rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.15s; }
.mx-mode:hover { border-color: rgba(255,255,255,0.4); }
.mx-mode.active { border-color: #ff6c1e; background: #ff6c1e; color: #11131a; }
.mx-mini { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.16); background: rgba(10,10,12,0.55); color: #f3ece0; cursor: pointer; backdrop-filter: blur(8px); }
.mx-mini.active { border-color: #ff6c1e; color: #ff6c1e; }

.mx-step { flex: 1 1 0; min-width: 0; background: rgba(10,10,12,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.7rem; padding: 0.7rem 0.9rem; backdrop-filter: blur(10px); max-width: 420px; }
.mx-step-count { font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #ff9a5c; }
.mx-step-title { font-family: "Fraunces", serif; font-weight: 700; font-size: 1rem; color: #faf3e8; margin: 0.1rem 0 0.15rem; }
.mx-step-text { font-size: 0.78rem; color: #d7cdbd; line-height: 1.45; }
.mx-nav { display: flex; gap: 0.4rem; flex-shrink: 0; }
.mx-nav-btn { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.18); background: rgba(10,10,12,0.6); color: #faf3e8; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.15s; }
.mx-nav-btn:hover { border-color: #ff6c1e; color: #ff6c1e; }

.mx-ui--custom { flex-direction: column; align-items: stretch; }
.mx-parts { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.45rem; }
.mx-part-tab { padding: 0.32rem 0.65rem; border-radius: 999px; border: 1.5px solid rgba(255,255,255,0.16); background: rgba(10,10,12,0.55); color: #f3ece0; font-size: 0.72rem; font-weight: 600; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.15s; }
.mx-part-tab.active { border-color: #ff6c1e; background: #ff6c1e; color: #11131a; }
.mx-swatches { display: flex; flex-wrap: wrap; gap: 0.4rem; background: rgba(10,10,12,0.5); border-radius: 0.6rem; padding: 0.45rem; backdrop-filter: blur(8px); width: fit-content; }
.mx-swatch { width: 28px; height: 28px; border-radius: 7px; cursor: pointer; border: 2px solid rgba(0,0,0,0.25); transition: transform 0.12s, box-shadow 0.12s; }
.mx-swatch:hover { transform: translateY(-2px); }
.mx-swatch.active { box-shadow: 0 0 0 2px #11131a, 0 0 0 4px #ff6c1e; }

.mx-debug { position: absolute; top: 54px; right: 10px; z-index: 5; width: 184px; background: rgba(10,10,12,0.82); border: 1px solid rgba(255,255,255,0.14); border-radius: 0.6rem; padding: 0.6rem 0.7rem; color: #e7ddca; backdrop-filter: blur(10px); font-size: 0.72rem; }
.mx-debug-h { display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: #ff9a5c; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.6rem; margin-bottom: 0.4rem; }
.mx-debug-x { background: none; border: none; color: #e7ddca; font-size: 1rem; cursor: pointer; line-height: 1; }
.mx-debug dl { display: flex; flex-direction: column; gap: 0.2rem; margin: 0; }
.mx-debug dl > div { display: flex; justify-content: space-between; gap: 0.5rem; font-variant-numeric: tabular-nums; }
.mx-debug dt { color: #9a8f7c; }
.mx-debug dd { margin: 0; font-weight: 600; }
.mx-debug-copy { margin-top: 0.5rem; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.35rem; border-radius: 0.45rem; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,108,30,0.15); color: #ffb486; font-size: 0.7rem; font-weight: 700; cursor: pointer; }
.mx-debug-hint { margin-top: 0.4rem; font-size: 0.6rem; color: #8f8674; line-height: 1.35; }
</style>
