<script setup lang="ts">
/**
 * CoryDoraField - the cold open: a staggered plane of CoryDoras drifting overhead,
 * each in its own Numakers colourway. On "Enter" it flies into ONE unit (picked at
 * random, so every visitor's first frame is different), framed to match the story's
 * opening shot, then emits that unit's colourway so the story can continue from it.
 *
 * Super-optimised: GPU instancing (one InstancedMesh per visible part → ~5 draw
 * calls), exterior parts only (the 82k-vert interior is dropped), per-instance
 * colour, static instances (the camera does the moving), fog, no shadows/env.
 */
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { PARTS } from "../../data/corydora-parts";

const props = defineProps<{ src: string }>();
const emit = defineEmits<{ start: [colors: Record<string, string>]; done: [] }>();

const wrap = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const started = ref(false);
let disposed = false;
const disposers: (() => void)[] = [];

// exterior meshes worth drawing, mapped to the colourway part that tints them
const FIELD_MESHES: Record<string, string> = {
  backplate: "body", frontplate: "body", trim: "trim", keycaps: "keycaps", knob: "knob",
};
function palette(id: string): string[] {
  return (PARTS.find((p) => p.id === id)?.options ?? []).map((o) => o.color);
}

// story opening framing ("meet" chapter), so the zoom lands where the story begins
const FRAME0 = {
  desktop: { pos: new THREE.Vector3(-43.7, 362.2, -26.8), target: new THREE.Vector3(1.8, 8.9, -35.2) },
  phone: { pos: new THREE.Vector3(-197.4, 575.7, 27.7), target: new THREE.Vector3(51.7, 29.3, -22) },
};
const FOV_WIDE = 44, FOV_NARROW = 38, ZOOM_DUR = 1700;

// shared with the render loop + the start handler
let camRef: THREE.PerspectiveCamera | null = null;
let instMtx: THREE.Matrix4[] = [];
let instCols: Record<string, string[]> = {};
const look = new THREE.Vector3();
let zooming = false, zoomStart = 0, zoomEmitted = false;
const zFromPos = new THREE.Vector3(), zToPos = new THREE.Vector3();
const zFromLook = new THREE.Vector3(), zToLook = new THREE.Vector3();

function start() {
  if (started.value || !instMtx.length || !camRef) return;
  started.value = true;
  const chosen = Math.floor(Math.random() * instMtx.length);     // unique to every visitor
  const colors: Record<string, string> = {
    body: instCols.body[chosen], trim: instCols.trim[chosen],
    keycaps: instCols.keycaps[chosen], knob: instCols.knob[chosen],
  };
  const P = new THREE.Vector3().setFromMatrixPosition(instMtx[chosen]);
  const f = window.matchMedia("(max-width: 720px)").matches ? FRAME0.phone : FRAME0.desktop;
  zToPos.copy(P).add(f.pos); zToLook.copy(P).add(f.target);
  zFromPos.copy(camRef.position); zFromLook.copy(look);
  zoomStart = performance.now(); zooming = true; zoomEmitted = false;
  emit("start", colors); // let the story spin up + adopt this colourway
}

onMounted(() => {
  const el = wrap.value; if (!el) return;
  const isPhone = window.matchMedia("(max-width: 720px)").matches;
  const COUNT = isPhone ? 30 : 90;

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
  catch { loading.value = false; return; }
  const w = el.clientWidth || 800, h = el.clientHeight || 600;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.3));
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0d12);
  scene.fog = new THREE.FogExp2(0x0c0d12, 0.00045);

  const camera = new THREE.PerspectiveCamera(FOV_WIDE, w / h, 1, 12000);
  camRef = camera;

  // lighting only (no env map - big per-fragment saving across the field)
  scene.add(new THREE.HemisphereLight(0xf3e6cf, 0x14161c, 0.95));
  const key = new THREE.DirectionalLight(0xfff3e2, 2.6); key.position.set(160, 320, 180); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fd0ff, 0.7); rim.position.set(-180, 80, -160); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.5); fill.position.set(60, 120, -220); scene.add(fill);

  const cols = Math.round(Math.sqrt(COUNT));
  const rows = Math.ceil(COUNT / cols);
  const SP = 240;
  const spanX = (cols - 1) * SP, spanZ = (rows - 1) * SP;

  const draco = new DRACOLoader().setDecoderPath("/draco/");
  new GLTFLoader().setDRACOLoader(draco).load(props.src, (gltf) => {
    if (disposed) return;

    const parts: { name: string; geo: THREE.BufferGeometry }[] = [];
    const box = new THREE.Box3();
    gltf.scene.traverse((o: any) => {
      if (!o.isMesh) return;
      const name = o.name.replace(/-Mesh$/, "").toLowerCase();
      if (!(name in FIELD_MESHES)) return;
      const g = o.geometry as THREE.BufferGeometry;
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      g.computeBoundingBox(); box.union(g.boundingBox!);
      parts.push({ name, geo: g });
    });
    const c = box.getCenter(new THREE.Vector3()), minY = box.min.y;
    parts.forEach((p) => { const g = p.geo.clone(); g.translate(-c.x, -minY, -c.z); p.geo = g; });

    const pal = { body: palette("body"), trim: palette("trim"), keycaps: palette("keycaps"), knob: palette("knob") };
    const mats: Record<string, string[]> = { body: [], trim: [], keycaps: [], knob: [] };
    const mtx: THREE.Matrix4[] = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
    const pick = (a: string[]) => a[(Math.random() * a.length) | 0];
    // staggered lattice - alternate rows shift half a cell for a looser "weird grid"
    for (let i = 0; i < COUNT; i++) {
      const gx = i % cols, gz = Math.floor(i / cols);
      const stagger = (gz % 2) * (SP * 0.5);
      pos.set((gx - (cols - 1) / 2) * SP + stagger, 0, (gz - (rows - 1) / 2) * SP);
      mtx.push(m4.compose(pos, q, scl).clone());
      for (const k of Object.keys(pal) as (keyof typeof pal)[]) mats[k].push(pick(pal[k]));
    }
    instMtx = mtx; instCols = mats; // exposed to start()

    const col = new THREE.Color();
    const meshes: THREE.InstancedMesh[] = [];
    for (const p of parts) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.52, metalness: 0.05 });
      const im = new THREE.InstancedMesh(p.geo, mat, COUNT);
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      im.frustumCulled = false;
      const part = FIELD_MESHES[p.name];
      for (let i = 0; i < COUNT; i++) { im.setMatrixAt(i, mtx[i]); im.setColorAt(i, col.set(mats[part][i])); }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      scene.add(im); meshes.push(im);
    }
    loading.value = false;
    disposers.push(() => meshes.forEach((im) => { im.geometry.dispose(); (im.material as THREE.Material).dispose(); im.dispose(); }));
  }, undefined, () => { loading.value = false; });

  let onscreen = true;
  const io = new IntersectionObserver((es) => { onscreen = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(el);
  const ro = new ResizeObserver(() => {
    const ww = el.clientWidth, hh = el.clientHeight; if (!ww || !hh) return;
    camera.aspect = ww / hh; camera.updateProjectionMatrix(); renderer.setSize(ww, hh);
  });
  ro.observe(el);

  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!onscreen && !zooming) return;
    if (zooming) {
      const k = Math.min(1, (performance.now() - zoomStart) / ZOOM_DUR);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out
      camera.position.lerpVectors(zFromPos, zToPos, e);
      look.lerpVectors(zFromLook, zToLook, e);
      camera.fov = FOV_WIDE + (FOV_NARROW - FOV_WIDE) * e; camera.updateProjectionMatrix();
      camera.lookAt(look);
      if (k >= 1 && !zoomEmitted) { zoomEmitted = true; emit("done"); }
    } else {
      const t = performance.now() / 1000;
      const cx = Math.sin(t * 0.05) * spanX * 0.42, cz = Math.sin(t * 0.037 + 1.0) * spanZ * 0.42;
      camera.position.set(cx, 540, cz);          // overhead, zoomed in
      look.set(cx * 0.5, 0, cz * 0.5 - 230);
      camera.lookAt(look);
    }
    renderer.render(scene, camera);
  }
  loop();

  disposers.push(() => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    renderer.dispose(); renderer.domElement.remove();
  });
});

onBeforeUnmount(() => { disposed = true; disposers.forEach((d) => d()); });
</script>

<template>
  <div class="cf">
    <div class="cf-stage" ref="wrap"></div>
    <div v-if="loading" class="cf-load">Summoning the swarm…</div>
    <transition name="cf-up">
      <div v-show="!started" class="cf-overlay">
        <p class="cf-eyebrow">Nine-key macropad</p>
        <h1 class="cf-title">A shoal of CoryDoras.</h1>
        <p class="cf-sub">Dive into one - it's yours.</p>
        <button class="cf-enter" :disabled="loading" @click="start">Dive in <i class="ph-bold ph-arrow-down"></i></button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.cf { position: relative; width: 100%; height: 100svh; min-height: 520px; background: #0c0d12; overflow: hidden; }
.cf-stage { position: absolute; inset: 0; }
.cf-load { position: absolute; inset: 0; display: grid; place-items: center; color: #cbb89a; font-size: 0.9rem; pointer-events: none; }
.cf-overlay {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; pointer-events: none;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 0 1.5rem 9vh; gap: 0.6rem;
  background: linear-gradient(to top, rgba(8,9,12,0.82) 0%, rgba(8,9,12,0.35) 45%, rgba(8,9,12,0) 100%);
}
.cf-eyebrow { font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; color: #ff9a5c; }
.cf-title { font-family: "Fraunces", serif; font-weight: 900; font-size: clamp(2.4rem, 7vw, 5rem); line-height: 0.98; color: #faf3e8; margin: 0; text-shadow: 0 4px 40px rgba(0,0,0,0.6); }
.cf-sub { max-width: 34rem; font-size: clamp(0.92rem, 2.2vw, 1.1rem); line-height: 1.5; color: #d7cdbd; }
.cf-enter {
  pointer-events: auto; margin-top: 0.6rem; display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.8rem 1.6rem; border-radius: 999px; border: none; cursor: pointer;
  background: #ff5900; color: #fff; font-size: 1rem; font-weight: 800;
  box-shadow: 0 10px 30px rgba(255,89,0,0.35); transition: transform 0.15s, background 0.15s;
}
.cf-enter:hover { background: #ff6c1e; transform: translateY(-2px); }
.cf-enter:disabled { opacity: 0.45; cursor: progress; transform: none; }
.cf-enter i { transition: transform 0.15s; }
.cf-enter:hover i { transform: translateY(3px); }
.cf-up-leave-active { transition: opacity 0.5s ease, transform 0.5s ease; }
.cf-up-leave-to { opacity: 0; transform: translateY(-12px); }
</style>
