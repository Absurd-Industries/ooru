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
import { ref, shallowRef, reactive, watch, onMounted, onBeforeUnmount } from "vue";
import { PARTS, type PartCfg } from "../data/corydora-parts";
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
  /** "embed" = fixed-height card (default); "page" = tall full-bleed hero. */
  variant?: "embed" | "page";
  /** When true, hide the built-in chrome (a parent island owns the UI). */
  embedded?: boolean;
}>();

// ── Tour ────────────────────────────────────────────────────────────────
// cam = the exact framing (world positions, in mm) captured from the debug panel.
interface TourStep {
  id: string; title: string; body: string;
  cam: { pos: [number, number, number]; target: [number, number, number] };
  show?: string[];        // parts to keep solid; others ghost + edges
  dims?: boolean; insert?: boolean; press?: boolean;
}
// Manual orbit can't go below ~65deg from top (stays above the floor);
// scripted camera frames may go lower and lift the cap temporarily.
const USER_MAX_POLAR = THREE.MathUtils.degToRad(65);
const PROG_MAX_POLAR = Math.PI * 0.52;

// Simulated OLED screen (the GLB has no screen mesh, so we add an emissive
// plane at the window). All placement is here so it's easy to nudge.
const OLED_POS = new THREE.Vector3(30, 20, -10);    // tuned onto the window
const OLED_SIZE = { w: 38, h: 9.5 };                // 4:1 to match the 128x32 OLED (tunable in ?debug)
const OLED_ROT = -Math.PI / 2;                       // in-plane spin
const OLED_W = 128, OLED_H = 32;                     // real OLED resolution
const KNOB_GLOW = new THREE.Color("#5fdcff");        // "press me" pulse on the encoder

// Our illustrative example layers (the firmware was only context for the screen).
const OLED_LAYERS = [
  { app: "VS Code", keys: ["Run", "Debug", "Format", "Find", "Cmd-P", "Term", "Git", "Comment", "Save"], enc: "Scroll" },
  { app: "Figma", keys: ["Frame", "Pen", "Text", "Group", "Align", "Mask", "Zoom", "Undo", "Export"], enc: "Zoom" },
  { app: "Media", keys: ["Prev", "Play", "Next", "Vol -", "Mute", "Vol +", "Mic", "Cam", "Share"], enc: "Volume" },
  { app: "Browser", keys: ["Back", "Fwd", "Reload", "New Tab", "Close", "Reopen", "Find", "Top", "Bottom"], enc: "Scroll" },
];

// Floor editorial panel + logo placement (tunable, like the camera frames)
const STORY_PANEL_H = 52;                            // world height of the headings panel
const STORY_PANEL_OFFSET = { x: -35, z: 80 };        // panel spot off the model's LEFT edge (used by all frames)
const LOGO_LONG = 80;                                // world size of the logo's long edge
const LOGO_POS = new THREE.Vector3(120, 0.16, 0);    // "on top" (+X) of the model
const MAP_OFFSET = { x: 0, z: 65 };                  // layer-map: x + distance beyond the front edge
const MAP_H = 112;                                   // layer-map world height

const TOUR: TourStep[] = [
  { id: "size", dims: true,
    cam: { pos: [-222.7, 283, 83.7], target: [-20.2, 4.3, 39.4] },
    title: "Palm-sized", body: "Nine keys, a rotary encoder and up to four layers - in a footprint that sits under your palm." },
  { id: "pcb", show: ["pcb"],
    cam: { pos: [-147, 93.2, -109.6], target: [-16, 1.5, -15.3] },
    title: "Open-source PCB", body: "Everything ghosts away to the open-source PCB - hot-swap sockets, RP2040, OLED, all public." },
  { id: "insert", show: ["pcb", "switches", "keycaps"], insert: true,
    cam: { pos: [-2, 36.8, -157.3], target: [-13.6, 16.9, 2.2] },
    title: "Drop-in switches", body: "Switch + keycap drop straight into the hot-swap sockets. No soldering required." },
  { id: "keys", press: true,
    cam: { pos: [-124, 267.2, 4.2], target: [-16, 14.7, -6.4] },
    title: "Cap it and type", body: "Pop on the keycaps and go - tactile, clicky or silent, your call." },
];

// ── Customizer ──────────────────────────────────────────────────────────
// Parts/colours live in shared data so the rich customizer UI can read them too.
// mesh name -> the part that controls its colour
const MESH_PART: Record<string, PartCfg> = {};
for (const p of PARTS) for (const m of p.meshes) MESH_PART[m] = p;
function colorFor(meshName: string): string | THREE.Color {
  const p = MESH_PART[meshName];
  return (p && chosen.value[p.id]) || S.value?.baseColor[meshName];
}

const mode = ref<"tour" | "customize">("tour");
const tourIndex = ref(0);
const activePart = ref(PARTS[0].id);
const chosen = ref<Record<string, string>>(Object.fromEntries(PARTS.map((p) => [p.id, p.options[0].color])));
const loading = ref(true);
const failed = ref(false);
const debugOn = ref(false);
// which target the debug copy buttons format for (auto-detects phone on open)
const debugPhone = ref(false);
const panelOpen = ref(true);
const isFs = ref(false);
const ready = ref(false); // flips true once the model has loaded (for parent islands)
let lastStory: any = null; // last floor-story request, re-drawn once web fonts load
// live-tunable floor placement (editable in the ?debug panel; copy values back to code)
const tune = reactive({
  panelX: STORY_PANEL_OFFSET.x, panelZ: STORY_PANEL_OFFSET.z,
  logoX: LOGO_POS.x, logoZ: LOGO_POS.z, logoSize: LOGO_LONG,
  oledX: OLED_POS.x, oledY: OLED_POS.y, oledZ: OLED_POS.z, oledRot: Math.round((OLED_ROT * 180) / Math.PI),
  oledW: OLED_SIZE.w, oledH: OLED_SIZE.h,
  mapX: MAP_OFFSET.x, mapZ: MAP_OFFSET.z, mapH: MAP_H,
});
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); // cap: full-screen bloom on retina is heavy
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
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
  controls.minDistance = 165; controls.maxDistance = 1000;
  controls.maxPolarAngle = PROG_MAX_POLAR;
  // Manual orbit stops just above the floor; programmatic frames (which may dip
  // lower) raise the cap, then the user's next drag snaps it back to USER_MAX.
  controls.addEventListener("start", () => { controls.maxPolarAngle = USER_MAX_POLAR; });

  // ── Lighting: warm key + soft hemisphere lift + cool fill + colour rims ──
  const key = new THREE.DirectionalLight(0xfff3e2, 2.7);
  key.position.set(150, 300, 170); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 20; key.shadow.camera.far = 1100; key.shadow.bias = -0.0004; key.shadow.radius = 9;
  Object.assign(key.shadow.camera as THREE.OrthographicCamera, { left: -200, right: 200, top: 200, bottom: -200 });
  scene.add(key);
  // hemisphere keeps the shadow side readable (better than pure-black ambient)
  const hemi = new THREE.HemisphereLight(0xf3e6cf, 0x14161c, 0.55); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xaec6ff, 0.5); fill.position.set(-160, 80, -30); scene.add(fill);
  const rimA = new THREE.DirectionalLight(0xff8a45, 0.8); rimA.position.set(120, 40, -200); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0x49d6de, 0.55); rimB.position.set(-150, 30, -160); scene.add(rimB);

  // ── Cassette-tech ground (orbits with camera) ──
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.85, metalness: 0.1, map: cassetteTexture(),
    transparent: true, alphaMap: radialAlpha(),
  });
  const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(520, 64), groundMat);
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);

  // ── Floor-printed text labels (annotations laid flat on the ground) ──
  const floorLabels: any[] = [];
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 256;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    // Lit material so the text reads as part of the floor (catches light + the
    // model's shadow, dims at grazing angles). polygonOffset avoids z-fighting.
    const mat = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, roughness: 0.92, metalness: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3; mesh.visible = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    floorLabels.push({ canvas, ctx: canvas.getContext("2d"), tex, mat, mesh });
  }

  // ── Surface-printing test sheet (debug only): rulers on all sides + font /
  //    icon swatches, printed flat on the floor so we can plan what reads well ──
  const debugSheet = buildDebugSheet();
  scene.add(debugSheet.mesh);

  // ── Postprocessing: render -> subtle bloom -> output (tone map + sRGB) ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.14, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  S.value = { renderer, composer, bloom, scene, camera, controls,
    key, hemi, fill, rimA, rimB, groundMat, floorLabels, debugSheet,
    meshes: {}, edges: {}, baseColor: {}, baseMat: {}, basePos: {}, colorTweens: [],
    switchBaseY: 0, keycapBaseY: 0, insertActive: false, pressActive: false,
    tween: null, raf: 0, ready: false, lastAspect: w / h };
  applyQuality(true); // start in the Studio look (instant, no fade)

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
      // brighter, slightly emissive PCB so it reads when isolated
      if (name === "pcb") {
        std.color.set("#2f9466"); std.emissive.set("#0e3a26"); std.emissiveIntensity = 0.5; std.roughness = 0.5;
      }
      m.castShadow = true; m.receiveShadow = true;
      S.value.meshes[name] = m;
      S.value.baseColor[name] = std.color.clone();
      // remember the pristine material params + position so render modes
      // (wireframe, clay, chrome, exploded…) can fully reset between cycles
      S.value.baseMat[name] = {
        roughness: std.roughness, metalness: std.metalness,
        emissive: std.emissive.clone(), emissiveIntensity: std.emissiveIntensity,
        envMapIntensity: std.envMapIntensity,
      };
      S.value.basePos[name] = m.position.clone();
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
    S.value.debugMarkers = buildDebugMarkers(size); scene.add(S.value.debugMarkers);
    buildOled();
    buildLayerMap();
    applyStep(0, true);
    S.value.ready = true;
    ready.value = true;
    loading.value = false;
  }, undefined, () => { failed.value = true; loading.value = false; });

  const ro = new ResizeObserver(() => {
    if (!S.value) return;
    const ww = wrap.clientWidth, hh = wrap.clientHeight; if (!ww || !hh) return;
    const st = S.value;
    const aspect = ww / hh;
    st.camera.aspect = aspect; st.camera.updateProjectionMatrix();
    st.renderer.setSize(ww, hh); st.composer.setSize(ww, hh);
    // Refit only on a big aspect change (orientation flip / first real size),
    // not on minor mobile URL-bar height jitter, so we don't yank mid-orbit.
    if (st.ready && Math.abs(aspect - (st.lastAspect ?? aspect)) / (st.lastAspect ?? aspect) > 0.25) {
      if (mode.value === "tour") applyStep(tourIndex.value, true);
      else selectPart(activePart.value);
    }
    st.lastAspect = aspect;
  });
  ro.observe(wrap); S.value._ro = ro;

  // pause the render loop when the stage is scrolled off-screen (big perf win:
  // no bloom/shadow/HDR/OLED work while the user reads the campaign body)
  S.value.onscreen = true;
  const io = new IntersectionObserver((es) => { if (S.value) S.value.onscreen = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(wrap); S.value._io = io;

  // keep the fullscreen icon in sync
  const onFs = () => { isFs.value = !!document.fullscreenElement; };
  document.addEventListener("fullscreenchange", onFs);
  S.value._onFs = onFs;

  // click the rotary encoder (knob) to switch OLED layers - just like the real one
  const raycaster = new THREE.Raycaster();
  const onCanvasClick = (e: MouseEvent) => {
    const st = S.value; if (!st?.oled || !st.meshes.knob) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, st.camera);
    if (raycaster.intersectObject(st.meshes.knob, true).length) cycleOledLayer();
  };
  renderer.domElement.addEventListener("click", onCanvasClick);
  S.value._onClick = onCanvasClick;

  // canvas floor text needs the web fonts loaded - redraw the story once they are
  (document as any).fonts?.ready?.then(() => { if (lastStory) setStoryFloor(lastStory); if (S.value?.layerMap) drawLayerMap(S.value.oled?.layer || 0); });

  // open the debug panel automatically with ?debug in the URL
  try { if (new URLSearchParams(location.search).has("debug")) debugOn.value = true; } catch {}

  // ── render loop ──
  const sph = new THREE.Spherical(), off = new THREE.Vector3();
  function loop() {
    if (!S.value || disposed) return;
    S.value.raf = requestAnimationFrame(loop);
    const st = S.value;
    if (!st.onscreen) return; // skip all work while the stage is off-screen
    if (st.tween) {
      const k = Math.min(1, (performance.now() - st.tween.start) / st.tween.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      st.camera.position.lerpVectors(st.tween.from, st.tween.to, e);
      st.controls.target.lerpVectors(st.tween.tFrom, st.tween.tTo, e);
      if (k >= 1) st.tween = null;
    }
    // drop-insert loop: switch + keycap fall into the sockets together
    const drop = st.insertActive ? 1 - Math.pow(1 - (performance.now() % 1700) / 1700, 3) : -1;
    if (st.meshes.switches) {
      const sw = st.meshes.switches;
      if (drop >= 0) sw.position.y = st.switchBaseY + 22 * (1 - drop);
      else sw.position.y += (st.switchBaseY - sw.position.y) * 0.2;
    }
    if (st.meshes.keycaps) {
      const kc = st.meshes.keycaps;
      if (drop >= 0) kc.position.y = st.keycapBaseY + 42 * (1 - drop); // caps fall from higher
      else if (st.pressActive) {
        const p = (Math.sin(performance.now() / 320) * 0.5 + 0.5) ** 2;
        kc.position.y = st.keycapBaseY - p * 1.35; // shallow press so caps meet switches, no bleed
      } else kc.position.y += (st.keycapBaseY - kc.position.y) * 0.2;
    }
    if (st.oled && st.oled.mesh.visible) {
      const now = performance.now();
      if (now - (st._oledT || 0) > 70) { drawOled(st.oled, now); st._oledT = now; } // ~14fps is plenty
    }
    // gently pulse the encoder so people know to click it - until they do, once
    if (st.knobHint && st.meshes.knob) {
      const mat = st.meshes.knob.material as THREE.MeshStandardMaterial;
      if (mat?.emissive) {
        const p = Math.sin(performance.now() / 360) * 0.5 + 0.5; // 0..1, ~1.1s breath
        mat.emissive.copy(KNOB_GLOW); mat.emissiveIntensity = 0.12 + p * 0.78;
      }
    }
    if (st.colorTweens?.length) {
      const now = performance.now();
      st.colorTweens = st.colorTweens.filter((tw: any) => {
        const t = Math.min(1, (now - tw.start) / tw.dur);
        tw.mat.color.copy(tw.from).lerp(tw.to, t * t * (3 - 2 * t)); // smoothstep
        return t < 1;
      });
    }
    if (st.qTween) {
      const q = st.qTween, now = performance.now();
      const t = q.dur ? Math.min(1, (now - q.start) / q.dur) : 1;
      const e = t * t * (3 - 2 * t);
      const lf = (a: number, b: number) => a + (b - a) * e;
      st.key.intensity = lf(q.from.key, q.to.key); st.hemi.intensity = lf(q.from.hemi, q.to.hemi);
      st.fill.intensity = lf(q.from.fill, q.to.fill); st.rimA.intensity = lf(q.from.rimA, q.to.rimA); st.rimB.intensity = lf(q.from.rimB, q.to.rimB);
      st.renderer.toneMappingExposure = lf(q.from.exp, q.to.exp);
      st.bloom.strength = lf(q.from.bloom, q.to.bloom);
      st.key.color.copy(q.from.keyC).lerp(q.to.keyC, e);
      st.groundMat.color.copy(q.from.groundC).lerp(q.to.groundC, e);
      if (st.scene.background?.isColor) st.scene.background.copy(q.from.bgC).lerp(q.to.bgC, e);
      if (st.scene.fog) { st.scene.fog.density = lf(q.from.fogD, q.to.fogD); st.scene.fog.color.copy(st.scene.background); }
      if (t >= 1) {
        if (q.to.fogNull) st.scene.fog = null;
        st.bloom.enabled = q.to.bloom > 0.002;
        st.qTween = null;
      }
    }
    if (st.floorFadeStart) {
      const t = Math.min(1, (performance.now() - st.floorFadeStart) / 450);
      for (const fl of st.floorLabels) if (fl.mesh.visible) fl.mat.opacity = t;
      if (t >= 1) st.floorFadeStart = 0;
    }
    if (st.flash) {
      const t = (performance.now() - st.flash.start) / st.flash.dur;
      if (t >= 1) { restoreAll(); st.flash = null; }
      else {
        const k = Math.sin(Math.PI * t);     // 0 -> 1 -> 0 (peek and back)
        const op = 1 - 0.92 * k;             // outer parts dip to ~0.08 then return
        for (const [name, m] of Object.entries<any>(st.meshes)) {
          if (st.flash.keep.has(name)) continue;
          const mat = m.material as THREE.MeshStandardMaterial;
          mat.transparent = true; mat.opacity = op; mat.depthWrite = op > 0.6; mat.needsUpdate = true;
          if (st.edges[name]) st.edges[name].visible = k > 0.25;
        }
      }
    }
    st.controls.update();
    st.composer.render();
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
  // orange floor lines - original colour, kept but hidden for now
  // x.strokeStyle = "rgba(255,108,30,0.7)"; x.lineWidth = 5;
  // x.beginPath(); x.moveTo(0, 188); x.lineTo(512, 188); x.stroke();
  // x.beginPath(); x.moveTo(0, 326); x.lineTo(512, 326); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── "magic" render modes: cycle through wild ways of seeing the model ──
// Beyond lighting, a mode can reshape the model itself: wireframe, edges-only
// (black frame), exploded, a uniform clay/chrome override, or emissive glow.
type VizMode = {
  label: string; bg: number; ground: number; keyColor: number;
  key: number; hemi: number; fill: number; rimA: number; rimB: number;
  exposure: number; tone: "neutral" | "agx";
  fog: number | null; bloom: number | null; // fog density / bloom strength (null = off)
  fx?: {
    wireframe?: boolean;       // render every part as wireframe
    edgesOnly?: boolean;       // ghost fills + show black-frame edges
    explode?: number;          // separate parts vertically by this many mm
    emissiveFromColor?: number; // make parts glow at this strength
    override?: { color?: number; roughness?: number; metalness?: number; envMapIntensity?: number };
  };
};
const MODES: VizMode[] = [
  { label: "Studio",    bg: 0x2e323b, ground: 0xffffff, keyColor: 0xfff1e0, key: 1.7, hemi: 0.7,  fill: 0.5,  rimA: 0.12, rimB: 0.08, exposure: 0.98, tone: "neutral", fog: null,    bloom: null },
  { label: "Noir",      bg: 0x0d0f14, ground: 0x6a6d73, keyColor: 0xffffff, key: 3.4, hemi: 0.18, fill: 0.22, rimA: 1.0,  rimB: 0.7,  exposure: 1.05, tone: "agx",     fog: 0.0016,  bloom: null },
  { label: "X-Ray",     bg: 0x06141c, ground: 0x0c2630, keyColor: 0x8fdfff, key: 1.2, hemi: 0.6,  fill: 0.5,  rimA: 0.8,  rimB: 0.9,  exposure: 1.1,  tone: "neutral", fog: null,    bloom: 0.5, fx: { edgesOnly: true } },
  { label: "Wireframe", bg: 0x07101e, ground: 0x10203a, keyColor: 0x9affc8, key: 1.6, hemi: 0.8,  fill: 0.6,  rimA: 0.6,  rimB: 0.5,  exposure: 1.1,  tone: "agx",     fog: null,    bloom: 0.55, fx: { wireframe: true, emissiveFromColor: 0.4 } },
  { label: "Exploded",  bg: 0x201a12, ground: 0x4a4034, keyColor: 0xffe6c2, key: 2.4, hemi: 0.5,  fill: 0.5,  rimA: 0.5,  rimB: 0.4,  exposure: 1.05, tone: "neutral", fog: null,    bloom: null, fx: { explode: 26 } },
  { label: "Clay",      bg: 0x2b2b30, ground: 0x9a948c, keyColor: 0xffffff, key: 2.0, hemi: 0.7,  fill: 0.55, rimA: 0.2,  rimB: 0.15, exposure: 1.0,  tone: "neutral", fog: null,    bloom: null, fx: { override: { color: 0xc9c4bb, roughness: 0.95, metalness: 0.0 } } },
  { label: "Chrome",    bg: 0x101216, ground: 0x3a3d44, keyColor: 0xffffff, key: 2.6, hemi: 0.5,  fill: 0.5,  rimA: 0.7,  rimB: 0.6,  exposure: 1.1,  tone: "agx",     fog: null,    bloom: 0.3, fx: { override: { color: 0xdfe3ea, roughness: 0.08, metalness: 1.0, envMapIntensity: 2.2 } } },
  { label: "Hologram",  bg: 0x040a16, ground: 0x0a1830, keyColor: 0x7fffe6, key: 1.0, hemi: 0.6,  fill: 0.4,  rimA: 1.1,  rimB: 1.2,  exposure: 1.18, tone: "agx",     fog: 0.0016,  bloom: 0.85, fx: { emissiveFromColor: 0.7 } },
  { label: "Neon",      bg: 0x0a0712, ground: 0x3a1f4d, keyColor: 0xff5fd0, key: 2.6, hemi: 0.3,  fill: 0.4,  rimA: 1.3,  rimB: 1.0,  exposure: 1.2,  tone: "agx",     fog: 0.0018,  bloom: 0.7 },
  { label: "Sunset",    bg: 0x2a1410, ground: 0x6b4a3a, keyColor: 0xff8a3c, key: 3.0, hemi: 0.35, fill: 0.4,  rimA: 0.85, rimB: 0.65, exposure: 1.12, tone: "agx",     fog: 0.0012,  bloom: 0.35 },
  { label: "Vapor",     bg: 0x120a2a, ground: 0x2a1f5e, keyColor: 0x9affff, key: 2.2, hemi: 0.5,  fill: 0.55, rimA: 1.1,  rimB: 0.9,  exposure: 1.15, tone: "agx",     fog: 0.0014,  bloom: 0.5 },
];
const modeIndex = ref(0);
// undo any geometry/material transform a previous mode applied
function resetModeEffects() {
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    const base = st.baseMat[name];
    mat.wireframe = false;
    if (base) {
      mat.roughness = base.roughness; mat.metalness = base.metalness;
      mat.emissive.copy(base.emissive); mat.emissiveIntensity = base.emissiveIntensity;
      mat.envMapIntensity = base.envMapIntensity;
    }
    if (st.basePos[name]) m.position.copy(st.basePos[name]);
    mat.needsUpdate = true;
  }
}
function applyModeEffects(fx: VizMode["fx"]) {
  const st = S.value; if (!st) return;
  resetModeEffects();
  if (fx?.edgesOnly) {
    // ghost every fill + show the black-frame edges (like the customizer)
    for (const [name, m] of Object.entries<any>(st.meshes)) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = true; mat.opacity = 0.06; mat.depthWrite = false; mat.needsUpdate = true;
      if (st.edges[name]) st.edges[name].visible = true;
    }
  } else {
    // restore solid fills + base/chosen colours (undoes a prior override/ghost),
    // then re-apply the customiser isolation if we're in that mode (no reframing)
    restoreAll();
    if (mode.value === "customize") {
      const part = PARTS.find((p) => p.id === activePart.value);
      if (part) showOnly(part.meshes);
    }
  }
  if (!fx) return;
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (fx.wireframe) mat.wireframe = true;
    if (fx.override) {
      if (fx.override.color != null) mat.color.set(fx.override.color);
      if (fx.override.roughness != null) mat.roughness = fx.override.roughness;
      if (fx.override.metalness != null) mat.metalness = fx.override.metalness;
      if (fx.override.envMapIntensity != null) mat.envMapIntensity = fx.override.envMapIntensity;
    }
    if (fx.emissiveFromColor != null) {
      mat.emissive.copy(mat.color); mat.emissiveIntensity = fx.emissiveFromColor;
    }
    if (fx.explode != null && st.basePos[name]) {
      // fan parts out vertically by their stack order (knob/keycaps up, pcb down)
      const order: Record<string, number> = { backplate: -2, pcb: -1, interior: -1, switches: 1, frontplate: 1, trim: 2, keycaps: 3, knob: 4 };
      m.position.y = st.basePos[name].y + (order[name] ?? 0) * fx.explode;
    }
    mat.needsUpdate = true;
  }
}
function applyQuality(instant = false) {
  const st = S.value; if (!st) return;
  const m = MODES[modeIndex.value];
  // discrete bits (can't be lerped): tone-mapping recompile + geometry/material fx
  const tm = m.tone === "agx" ? THREE.AgXToneMapping : THREE.NeutralToneMapping;
  if (st.renderer.toneMapping !== tm) {
    st.renderer.toneMapping = tm;
    st.scene.traverse((o: any) => { if (o.material) o.material.needsUpdate = true; });
  }
  if (st.ready) applyModeEffects(m.fx);
  if (!st.scene.background?.isColor) st.scene.background = new THREE.Color(m.bg);
  // keep bloom + fog alive during the cross-fade; trimmed at the tween's end
  st.bloom.enabled = (m.bloom != null) || st.bloom.strength > 0.002;
  if (!st.scene.fog && m.fog != null) st.scene.fog = new THREE.FogExp2(m.bg, 0.0001);

  const from = {
    key: st.key.intensity, hemi: st.hemi.intensity, fill: st.fill.intensity, rimA: st.rimA.intensity, rimB: st.rimB.intensity,
    exp: st.renderer.toneMappingExposure, bloom: st.bloom.strength,
    keyC: st.key.color.clone(), groundC: st.groundMat.color.clone(), bgC: st.scene.background.clone(),
    fogD: st.scene.fog ? (st.scene.fog as any).density : 0,
  };
  const to = {
    key: m.key, hemi: m.hemi, fill: m.fill, rimA: m.rimA, rimB: m.rimB,
    exp: m.exposure, bloom: m.bloom ?? 0,
    keyC: new THREE.Color(m.keyColor), groundC: new THREE.Color(m.ground), bgC: new THREE.Color(m.bg),
    fogD: m.fog ?? 0, fogNull: m.fog == null,
  };
  st.qTween = { from, to, start: performance.now(), dur: instant ? 0 : 700 };
}
function cycleMode() {
  modeIndex.value = (modeIndex.value + 1) % MODES.length;
  applyQuality();
}
function toggleFullscreen() {
  const el = canvasWrap.value; if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else (el as any).requestFullscreen?.();
}
watch(debugOn, (on) => {
  if (on) {
    try { debugPhone.value = window.matchMedia("(max-width: 720px)").matches; } catch {}
    // start the panel sliders from whatever placement is live (phone panelPos or the desktop default)
    if (lastStory?.panelPos) { tune.panelX = lastStory.panelPos.x; tune.panelZ = lastStory.panelPos.z; }
    if (lastStory) setStoryFloor(lastStory);
  }
  applyDebugSurface();
});
// live floor tuning: re-apply placements whenever a tune value changes
watch(tune, () => { if (lastStory) setStoryFloor(lastStory); applyLogoTune(); applyOledTune(); applyLayerMapTune(); }, { deep: true });
function toggleDebug() { debugOn.value = !debugOn.value; }
function copyTune() {
  const v = tune;
  // shared constants (same on phone + desktop): logo / OLED / layer-map
  const shared =
`LOGO_POS = (${v.logoX}, 0.16, ${v.logoZ})   LOGO_LONG = ${v.logoSize}
OLED_POS = (${v.oledX}, ${v.oledY}, ${v.oledZ})   OLED_ROT = ${v.oledRot}°   OLED_SIZE = { w: ${v.oledW}, h: ${v.oledH} }
MAP_OFFSET = { x: ${v.mapX}, z: ${v.mapZ} }   MAP_H = ${v.mapH}`;
  const snippet = debugPhone.value
    // phone: the only per-frame phone value is the floor panel; rest is shared
    ? `panelMobile: { x: ${v.panelX}, z: ${v.panelZ} },\n// shared constants (unchanged on phone):\n${shared}`
    : `STORY_PANEL_OFFSET = { x: ${v.panelX}, z: ${v.panelZ} }\n${shared}`;
  navigator.clipboard?.writeText(snippet);
}

// ── public API — lets a parent island (the rich page) drive the viewer ──
function setPartColor(partId: string, color: string) { pickColor(partId, color); }
function getConfig(): Record<string, string> { return { ...chosen.value }; }
function goStep(i: number) { if (mode.value !== "tour") enterTour(); applyStep(i); }
function setMode(which: number | string) {
  const i = typeof which === "number"
    ? which
    : MODES.findIndex((m) => m.label.toLowerCase() === String(which).toLowerCase());
  if (i >= 0) { modeIndex.value = i; applyQuality(); }
}
function isolate(parts?: string[]) { if (!parts || !parts.length) restoreAll(); else showOnly(parts); }
function frameTo(cam: Cam, parts?: string[]) { frameCam(cam, radiusOf(parts)); }
defineExpose({
  parts: PARTS, modes: MODES, ready,
  setPartColor, getConfig, goStep, setMode, isolate, frameTo,
  setStoryFloor, setDims, setFloorLogo, setOled, toggleDebug, flashPart,
  enterTour, enterCustomize, cycleMode,
});

// ── dimension lines ──
function buildDims(size: THREE.Vector3): THREE.Group {
  const grp = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0xf2f0ea });
  const hw = size.x / 2, hd = size.z / 2, y = 0.6, m = 12, tk = 6;
  const seg = (pts: number[][]) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), mat);
  // width (X) dimension hugging the right edge; depth (Z) hugging the front edge
  grp.add(seg([[hw + m, y, -hd], [hw + m, y, hd]]));
  grp.add(seg([[hw + m - tk, y, -hd], [hw + m + tk, y, -hd]]));
  grp.add(seg([[hw + m - tk, y, hd], [hw + m + tk, y, hd]]));
  grp.add(seg([[-hw, y, hd + m], [hw, y, hd + m]]));
  grp.add(seg([[-hw, y, hd + m - tk], [-hw, y, hd + m + tk]]));
  grp.add(seg([[hw, y, hd + m - tk], [hw, y, hd + m + tk]]));
  grp.visible = false;
  // widthAt = right side (the 109), depthAt = front (the 79)
  grp.userData = { widthAt: new THREE.Vector3(hw + m, y, 0), depthAt: new THREE.Vector3(0, y, hd + m) };
  return grp;
}

// ── floor-printed annotations (text laid flat on the ground, decal style) ──
// Each block is drawn to a content-sized canvas in the site's editorial type
// (Fraunces / DM Sans) so floor prints read like the on-screen copy.
type FloorRole = "eyebrow" | "script" | "title" | "body" | "label" | "panel";
type FloorSpec = { text?: string; lines?: string[]; role?: FloorRole; x: number; z: number; h: number; rot?: number; align?: "left" | "center" | "right"; opts?: any };
const FLOOR_TEXT_ROT = -Math.PI / 2; // text runs along +Z to face the start view

function floorStyle(role: FloorRole) {
  switch (role) {
    case "eyebrow": return { font: '800 64px "DM Sans", sans-serif', color: "#ff9a5c", lh: 84, upper: true, ls: 7, wrap: 0 };
    case "script":  return { font: 'italic 500 150px "Fraunces", serif', color: "#f3ece0", lh: 168, upper: false, ls: 0, wrap: 0 };
    case "title":   return { font: '800 132px "Fraunces", serif', color: "#faf3e8", lh: 150, upper: false, ls: 0, wrap: 0 };
    case "body":    return { font: '400 60px "DM Sans", sans-serif', color: "#e6ddcd", lh: 86, upper: false, ls: 0, wrap: 1180 };
    default:        return { font: '800 120px "DM Sans", sans-serif', color: "#ffffff", lh: 150, upper: false, ls: 0, wrap: 0 };
  }
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/); const out: string[] = []; let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
// A whole-chapter editorial composition drawn onto ONE content-sized canvas
// (eyebrow / script / title / rule / body / facts), so blocks never overlap.
function drawStoryPanel(fl: any, o: any): { cw: number; ch: number; n: number } {
  const ctx = fl.ctx as CanvasRenderingContext2D; const Wc = 820, pad = 38;
  fl.canvas.width = Wc; fl.canvas.height = 16;       // valid ctx for measuring
  const items: { font: string; ls: number; color: string; lines: string[]; lh: number; y: number }[] = [];
  let y = pad;
  if (o.eyebrow) { const f = '800 30px "DM Sans", sans-serif'; items.push({ font: f, ls: 5, color: "#ff9a5c", lines: [o.eyebrow.toUpperCase()], lh: 44, y }); y += 44 + 10; }
  if (o.script) { const f = 'italic 500 76px "Fraunces", serif'; items.push({ font: f, ls: 0, color: "#f3ece0", lines: [o.script], lh: 84, y }); y += 84 + 2; }
  if (o.title) { const f = '900 90px "Fraunces", serif'; const lines = String(o.title).split("\n"); items.push({ font: f, ls: 0, color: "#faf3e8", lines, lh: 92, y }); y += 92 * lines.length + 12; }
  const ruleY = y; y += 18;                          // short accent rule under the headings
  const H = y + pad;
  fl.canvas.height = H;                              // resets the context
  ctx.textAlign = "right"; ctx.textBaseline = "top"; // panel sits left of the model -> flush right
  const ax = Wc - pad;
  for (const it of items) { ctx.font = it.font; (ctx as any).letterSpacing = `${it.ls}px`; ctx.fillStyle = it.color; it.lines.forEach((l, i) => ctx.fillText(l, ax, it.y + i * it.lh)); }
  ctx.strokeStyle = "#ff9a5c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax - 130, ruleY + 6); ctx.lineTo(ax, ruleY + 6); ctx.stroke();
  commitFloorCanvas(fl);
  return { cw: Wc, ch: H, n: 1 };
}
// A resized canvas needs a fresh GPU texture, else the re-upload overflows the
// old allocation (GL_INVALID_VALUE) and shows a STALE heading from a prior chapter.
function commitFloorCanvas(fl: any) {
  if (fl._w === fl.canvas.width && fl._h === fl.canvas.height) { fl.tex.needsUpdate = true; return; }
  fl.tex.dispose?.();
  const tex = new THREE.CanvasTexture(fl.canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  fl.tex = tex; fl.mat.map = tex; fl.mat.needsUpdate = true;
  fl._w = fl.canvas.width; fl._h = fl.canvas.height;
}
function drawFloorBlock(fl: any, spec: FloorSpec): { cw: number; ch: number; n: number } {
  if (spec.role === "panel") return drawStoryPanel(fl, spec.opts);
  const ctx = fl.ctx; const st = floorStyle(spec.role ?? "label");
  let lines = spec.lines ? spec.lines.slice() : (spec.text ?? "").split("\n");
  ctx.font = st.font; (ctx as any).letterSpacing = `${st.ls}px`;
  if (st.wrap) lines = lines.flatMap((l) => wrapLines(ctx, l, st.wrap));
  if (st.upper) lines = lines.map((l) => l.toUpperCase());
  let w = 1; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  const pad = 16;
  const cw = Math.ceil(w) + pad * 2, ch = Math.ceil(st.lh * lines.length) + pad * 2;
  fl.canvas.width = cw; fl.canvas.height = ch;
  // canvas resize resets the context - re-apply
  ctx.font = st.font; (ctx as any).letterSpacing = `${st.ls}px`;
  ctx.textBaseline = "top"; ctx.fillStyle = st.color;
  const align = spec.align ?? "left";
  ctx.textAlign = align;
  const ax = align === "right" ? cw - pad : align === "center" ? cw / 2 : pad;
  lines.forEach((l, i) => ctx.fillText(l, ax, pad + i * st.lh));
  commitFloorCanvas(fl);
  return { cw, ch, n: lines.length };
}
function setFloorLabels(specs: FloorSpec[]) {
  const st = S.value; if (!st) return;
  st.floorLabels.forEach((fl: any, i: number) => {
    const s = specs[i];
    if (!s) { fl.mesh.visible = false; return; }
    const { cw, ch } = drawFloorBlock(fl, s);
    const worldH = s.h;                     // h = total block world height
    fl.mesh.position.set(s.x, 0.15, s.z);
    fl.mesh.scale.set(worldH * (cw / ch), worldH, 1);
    fl.mesh.rotation.z = s.rot ?? FLOOR_TEXT_ROT;
    fl.mesh.visible = true;
  });
}
// ── surface-printing test sheet (debug planning aid) ──
const DBG_WORLD = 150; // world size of the test card (kept near the model)
function buildDebugSheet() {
  const N = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = N; canvas.height = N;
  const ctx = canvas.getContext("2d")!;
  drawDebugSheet(ctx, N);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(DBG_WORLD, DBG_WORLD), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.32; mesh.renderOrder = 2; mesh.visible = false;
  return { canvas, ctx, tex, mat, mesh };
}
function drawDebugSheet(ctx: CanvasRenderingContext2D, N: number) {
  ctx.clearRect(0, 0, N, N);
  const half = DBG_WORLD / 2;             // world -half..half maps to 0..N
  const w2p = (w: number) => (w + half) / DBG_WORLD * N;
  const white = "rgba(255,255,255,0.92)";
  const dim = "rgba(255,255,255,0.45)";
  const stamp = "#ff8a3c";

  // ---- rulers on all four edges (ticks every 10mm, labels every 50mm) ----
  ctx.strokeStyle = dim; ctx.fillStyle = white;
  ctx.lineWidth = 2; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  for (let mm = -150; mm <= 150; mm += 10) {
    const p = w2p(mm);
    const major = mm % 50 === 0;
    const len = major ? 46 : (mm % 50 === 0 ? 46 : 26);
    ctx.lineWidth = major ? 4 : 2;
    // top & bottom edges (ticks along X)
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, len); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, N); ctx.lineTo(p, N - len); ctx.stroke();
    // left & right edges (ticks along Y)
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(len, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(N, p); ctx.lineTo(N - len, p); ctx.stroke();
    if (major) {
      ctx.font = "600 34px Arial, sans-serif";
      ctx.fillText(`${mm}`, p, 70);
      ctx.fillText(`${mm}`, p, N - 70);
      ctx.fillText(`${mm}`, 84, p);
      ctx.fillText(`${mm}`, N - 84, p);
    }
  }
  // frame border + "mm" units corner
  ctx.strokeStyle = dim; ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, N - 112, N - 112);
  ctx.fillStyle = dim; ctx.font = "700 30px Arial, sans-serif";
  ctx.textAlign = "left"; ctx.fillText("mm", 70, 110);

  // ---- font tests (which typefaces read as floor prints) ----
  const fonts = [
    "800 96px Fraunces, Georgia, serif",
    "800 96px 'DM Sans', Arial, sans-serif",
    "700 96px Georgia, serif",
    "700 96px 'Courier New', monospace",
    "900 96px Impact, sans-serif",
  ];
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  let y = 720;
  for (const f of fonts) {
    ctx.font = f; ctx.fillStyle = white;
    ctx.fillText("109 mm  AaBb 0123", N / 2, y);
    ctx.fillStyle = dim; ctx.font = "500 26px Arial, sans-serif";
    ctx.fillText(f.replace(/^[0-9 ]*px /, "").replace(/['"]/g, ""), N / 2, y + 30);
    y += 150;
  }

  // ---- icon / shape print tests (vector glyphs on the floor) ----
  const iy = y + 40, r = 46, gap = 200, cx0 = N / 2 - gap * 2;
  ctx.lineWidth = 8; ctx.lineJoin = "round";
  const icons: ((x: number) => void)[] = [
    (x) => { ctx.beginPath(); ctx.arc(x, iy, r, 0, Math.PI * 2); ctx.fill(); },                           // disc
    (x) => { ctx.beginPath(); ctx.arc(x, iy, r, 0, Math.PI * 2); ctx.stroke(); },                         // ring
    (x) => { ctx.strokeRect(x - r, iy - r, r * 2, r * 2); },                                              // square
    (x) => { ctx.beginPath(); ctx.moveTo(x, iy - r); ctx.lineTo(x + r, iy + r); ctx.lineTo(x - r, iy + r); ctx.closePath(); ctx.stroke(); }, // triangle
    (x) => { ctx.beginPath(); ctx.moveTo(x - r, iy); ctx.lineTo(x + r, iy); ctx.moveTo(x + r - 18, iy - 18); ctx.lineTo(x + r, iy); ctx.lineTo(x + r - 18, iy + 18); ctx.stroke(); }, // arrow
  ];
  icons.forEach((fn, i) => { ctx.fillStyle = i % 2 ? stamp : white; ctx.strokeStyle = i % 2 ? stamp : white; fn(cx0 + i * gap); });
  // unicode glyph test (depends on system fonts)
  ctx.fillStyle = white; ctx.font = "400 88px Arial, sans-serif"; ctx.textBaseline = "middle";
  ctx.fillText("★ ✦ ✕ ◆ ⬡ →", N / 2, iy + 150);
}
// ── body-framing debug markers (rulers + cage hugging the real model) ──
function buildDebugMarkers(size: THREE.Vector3): THREE.Group {
  const grp = new THREE.Group();
  const margin = 42;
  const W = size.x + margin * 2, D = size.z + margin * 2;
  // floor ruler frame, canvas sized to the footprint + margin
  const N = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = N; canvas.height = Math.max(2, Math.round((N * D) / W));
  const ctx = canvas.getContext("2d")!;
  drawBodyRuler(ctx, canvas.width, canvas.height, size, margin);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat);
  plane.rotation.x = -Math.PI / 2; plane.position.y = 0.18; plane.renderOrder = 2;
  grp.add(plane);
  // wireframe cage around the body bbox
  const cage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
    new THREE.LineBasicMaterial({ color: 0x49d6de, transparent: true, opacity: 0.7 })
  );
  cage.position.y = size.y / 2; grp.add(cage);
  // vertical corner posts (height reference) at the four top corners
  const hw = size.x / 2, hd = size.z / 2;
  const post = new THREE.LineBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.8 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(sx * hw, 0, sz * hd), new THREE.Vector3(sx * hw, size.y, sz * hd),
    ]);
    grp.add(new THREE.Line(g, post));
  }
  grp.visible = false;
  return grp;
}
function drawBodyRuler(ctx: CanvasRenderingContext2D, cw: number, ch: number, size: THREE.Vector3, margin: number) {
  ctx.clearRect(0, 0, cw, ch);
  const W = size.x + margin * 2, D = size.z + margin * 2;
  const sx = cw / W, sz = ch / D;                 // world->px scale
  const x2p = (wx: number) => (wx + W / 2) * sx;   // world x -> canvas x
  const z2p = (wz: number) => (wz + D / 2) * sz;   // world z -> canvas y
  const hw = size.x / 2, hd = size.z / 2;
  const cyan = "#7fe4ec", dim = "rgba(255,255,255,0.4)", stamp = "#ff8a3c", white = "rgba(255,255,255,0.92)";

  // body footprint rectangle
  ctx.strokeStyle = cyan; ctx.lineWidth = 2.5;
  ctx.strokeRect(x2p(-hw), z2p(-hd), size.x * sx, size.z * sz);

  // ticks every 10mm hugging each edge, longer + numbered every 50mm
  ctx.fillStyle = white; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const tick = (wx: number, wz: number, dx: number, dz: number, len: number, lw: number) => {
    ctx.strokeStyle = dim; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x2p(wx), z2p(wz)); ctx.lineTo(x2p(wx) + dx * len, z2p(wz) + dz * len); ctx.stroke();
  };
  for (let mm = -Math.floor(hw / 10) * 10; mm <= hw; mm += 10) {
    const major = mm % 50 === 0;
    tick(mm, -hd, 0, -1, major ? 16 : 9, major ? 3 : 1.5);   // top edge, outward (-z)
    tick(mm, hd, 0, 1, major ? 16 : 9, major ? 3 : 1.5);     // bottom edge
    if (major) { ctx.font = "600 18px Arial, sans-serif"; ctx.fillText(`${mm}`, x2p(mm), z2p(-hd) - 26); }
  }
  for (let mm = -Math.floor(hd / 10) * 10; mm <= hd; mm += 10) {
    const major = mm % 50 === 0;
    tick(-hw, mm, -1, 0, major ? 16 : 9, major ? 3 : 1.5);   // left edge
    tick(hw, mm, 1, 0, major ? 16 : 9, major ? 3 : 1.5);     // right edge
    if (major) { ctx.font = "600 18px Arial, sans-serif"; ctx.fillText(`${mm}`, x2p(hw) + 30, z2p(mm)); }
  }
  // corner crosshairs
  ctx.strokeStyle = stamp; ctx.lineWidth = 2;
  for (const cx of [-hw, hw]) for (const cz of [-hd, hd]) {
    ctx.beginPath(); ctx.moveTo(x2p(cx) - 12, z2p(cz)); ctx.lineTo(x2p(cx) + 12, z2p(cz));
    ctx.moveTo(x2p(cx), z2p(cz) - 12); ctx.lineTo(x2p(cx), z2p(cz) + 12); ctx.stroke();
  }
  // centre crosshair + axis labels
  ctx.strokeStyle = cyan; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x2p(0) - 16, z2p(0)); ctx.lineTo(x2p(0) + 16, z2p(0));
  ctx.moveTo(x2p(0), z2p(0) - 16); ctx.lineTo(x2p(0), z2p(0) + 16); ctx.stroke();
  ctx.fillStyle = stamp; ctx.font = "700 20px Arial, sans-serif";
  ctx.fillText("X →", x2p(hw) - 6, z2p(hd) + 24);
  ctx.fillText("Z", x2p(-hw) - 22, z2p(0));
  // dimension callouts
  ctx.fillStyle = white; ctx.font = "800 26px Arial, sans-serif";
  ctx.fillText(`${Math.round(size.x)} mm`, x2p(0), z2p(hd) + 30);
  ctx.save(); ctx.translate(x2p(-hw) - 30, z2p(0)); ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${Math.round(size.z)} mm`, 0, 0); ctx.restore();
}
function applyDebugSurface() {
  const st = S.value; if (!st) return;
  const on = debugOn.value;
  const sz = st.modelSize;
  // black-frame the body (edges on every part, like the customizer)
  for (const el of Object.values<any>(st.edges)) el.visible = on;
  if (st.debugMarkers) st.debugMarkers.visible = on;
  // the font/icon/ruler test palette, tucked just in front of the model
  if (st.debugSheet) {
    st.debugSheet.mesh.visible = on;
    if (on && sz) st.debugSheet.mesh.position.set(0, 0.3, sz.z / 2 + DBG_WORLD / 2 + 10);
  }
  if (st.layerMap) st.layerMap.mesh.visible = !on && st.oled?.program === "via";
  if (st.oled) st.oled.mesh.visible = !on;
  if (on) {
    if (st.dims) st.dims.visible = false;
    st.floorLabels.forEach((fl: any) => (fl.mesh.visible = false));
  } else {
    if (mode.value === "tour") applyStep(tourIndex.value, true); // restore the step's visuals
    else selectPart(activePart.value);
    applyModeEffects(MODES[modeIndex.value].fx);                 // re-assert the active magic mode
  }
}

function updateFloorLabels(step: TourStep) {
  const st = S.value; const sz = st?.modelSize; if (!st || !sz) return;
  const hw = sz.x / 2, hd = sz.z / 2;
  const specs: FloorSpec[] = [];
  if (step.dims) {
    // both dimension labels printed around the model, facing the start view
    const d = props.dimensions;
    specs.push({ text: d ? `${Math.round(d.w)} mm` : "width", x: 0, z: hd + 26, h: 15 });
    specs.push({ text: d ? `${Math.round(d.d)} mm` : "depth", x: -hw - 28, z: 0, h: 15 });
  } else {
    const text = step.id === "pcb" ? "OPEN-SOURCE PCB"
      : step.insert ? "DROP-IN SWITCHES"
      : step.press ? "HOT-SWAP KEYS" : "";
    if (text) specs.push({ text, x: 0, z: hd + 50, h: 24 });
  }
  setFloorLabels(specs);
}

// Parent-driven floor print for the rich tour. Model stays centred; the story
// type is printed around it in the site's editorial fonts:
//   - headline cluster (eyebrow / script / title) anchored off the TOP-RIGHT edge
//   - body wrapped along the front edge, facts list down the left, dims on the size step
// All offsets are grouped here so they're easy to tune (like the camera frames).
type StoryOpts = { eyebrow?: string; script?: string; title?: string; body?: string; specs?: { label: string; value: string }[]; dims?: boolean; panel?: { dx?: number; dz?: number }; panelPos?: { x: number; z: number }; fade?: boolean };
function setDims(on: boolean) { if (S.value?.dims) S.value.dims.visible = on; }
function setStoryFloor(opts: StoryOpts) {
  const st = S.value; const sz = st?.modelSize; if (!st || !sz) return;
  const hw = sz.x / 2, hd = sz.z / 2;
  setDims(!!opts.dims);
  const specs: FloorSpec[] = [];

  // ONE composed editorial panel off the model's left edge, same spot every
  // frame. Optional per-chapter dx/dz fine-tunes a frame if needed.
  const hasText = opts.eyebrow || opts.script || opts.title || opts.body || (opts.specs && opts.specs.length);
  if (hasText) {
    const dx = opts.panel?.dx ?? 0, dz = opts.panel?.dz ?? 0;
    // panelPos = absolute override (phone-specific placement). While the debug
    // panel is open the live tuner sliders win, so you can tune either target.
    const usePos = opts.panelPos && !debugOn.value;
    const px = usePos ? opts.panelPos!.x : tune.panelX + dx;
    const pz = usePos ? -hd - opts.panelPos!.z : -hd - tune.panelZ + dz;
    specs.push({ role: "panel", opts, x: px, z: pz, h: STORY_PANEL_H });
  }

  // mm dimensions printed beside their scale lines (width along the front, depth up the right)
  if (opts.dims) {
    const d = props.dimensions;
    if (d) {
      specs.push({ text: `${Math.round(d.w)} mm`, role: "label", x: 0, z: hd + 22, h: 11, rot: 0 });
      specs.push({ text: `${Math.round(d.d)} mm`, role: "label", x: hw + 22, z: 0, h: 11, rot: -Math.PI / 2 });
    }
  }
  setFloorLabels(specs);
  if (opts.fade) { // fade the new floor text in on a chapter change
    for (const fl of st.floorLabels) if (fl.mesh.visible) fl.mat.opacity = 0;
    st.floorFadeStart = performance.now();
  }
  lastStory = opts; // for the fonts-ready redraw
}

// The CoryDora logo, printed on the floor just above (behind) the model.
function setFloorLogo(on: boolean) {
  const st = S.value; const sz = st?.modelSize; if (!st || !sz) return;
  if (on && !st.logoMesh) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    // lie flat + spin to read the same way as the floor text (along +Z)
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = FLOOR_TEXT_ROT; mesh.renderOrder = 3;
    st.logoAspect = 1;
    new THREE.TextureLoader().load("/images/brand/corydora-transparent.png", (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; mat.map = t; mat.needsUpdate = true;
      st.logoAspect = (t.image?.width || 1) / (t.image?.height || 1); // keep aspect, no squish
      applyLogoTune();
    });
    st.scene.add(mesh); st.logoMesh = mesh;
    applyLogoTune();
  }
  if (st.logoMesh) st.logoMesh.visible = on;
}
function applyLogoTune() {
  const st = S.value; if (!st?.logoMesh) return;
  st.logoMesh.position.set(tune.logoX, 0.16, tune.logoZ);
  const a = st.logoAspect || 1;
  if (a >= 1) st.logoMesh.scale.set(tune.logoSize, tune.logoSize / a, 1);
  else st.logoMesh.scale.set(tune.logoSize * a, tune.logoSize, 1);
}
function applyOledTune() {
  const st = S.value; if (!st?.oled) return;
  const m = st.oled.mesh;
  m.position.set(tune.oledX, tune.oledY, tune.oledZ);
  m.rotation.z = (tune.oledRot * Math.PI) / 180;
  m.scale.set(tune.oledW, tune.oledH, 1); // canvas stays 128x32 (real res); plane just scales it
}

// ── simulated OLED screen: a cyan layer switcher (4 layers + Deku logo) ──
const OLED_CYAN = "#5fdcff";
function buildOled() {
  const st = S.value; if (!st) return;
  const canvas = document.createElement("canvas");
  canvas.width = OLED_W; canvas.height = OLED_H;        // real 128x32 resolution
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; // crisp OLED pixels
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = OLED_ROT;
  mesh.position.copy(OLED_POS); mesh.scale.set(OLED_SIZE.w, OLED_SIZE.h, 1); mesh.renderOrder = 4;
  st.scene.add(mesh);
  st.oled = { canvas, ctx: canvas.getContext("2d"), tex, mesh, program: "logo", layer: 0 };
  drawOled(st.oled, 0);
}
function setOled(program: string) {
  const st = S.value; if (!st?.oled) return;
  st.oled.program = program || "via";
  st.oled.mesh.visible = true;
  drawOled(st.oled, performance.now());
  // the layer map (VIA demo) only belongs on the VIA chapter
  const isVia = st.oled.program === "via";
  if (st.layerMap) st.layerMap.mesh.visible = isVia;
  if (isVia) drawLayerMap(st.oled.layer || 0);
  // hint the encoder on the VIA chapter until it's been clicked once
  st.knobHint = isVia && !st.knobUsed;
  if (!st.knobHint) restoreKnobEmissive();
}
function restoreKnobEmissive() {
  const st = S.value; if (!st?.meshes?.knob) return;
  const mat = st.meshes.knob.material as THREE.MeshStandardMaterial; const base = st.baseMat?.knob;
  if (mat?.emissive && base) { mat.emissive.copy(base.emissive); mat.emissiveIntensity = base.emissiveIntensity; }
}
function cycleOledLayer() {
  const st = S.value; if (!st?.oled || st.oled.program !== "via") return; // only on the VIA screen
  st.knobUsed = true; st.knobHint = false; restoreKnobEmissive(); // they pressed it - stop the glow
  st.oled.layer = ((st.oled.layer || 0) + 1) % OLED_LAYERS.length;
  drawOled(st.oled, performance.now());
  drawLayerMap(st.oled.layer);
  if (st.layerMap) st.layerMap.mesh.visible = true;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawOled(o: any, t: number) {
  const ctx = o.ctx as CanvasRenderingContext2D; const W = o.canvas.width, H = o.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#02070d"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = OLED_CYAN; ctx.fillStyle = OLED_CYAN;
  const cx0 = W / 2, cy0 = H / 2;
  const p = o.program || "via";
  if (p === "via") {
    // the 4 layer squares with tiny 1-2-3-4; active one filled (no blinking)
    const active = o.layer || 0, portrait = H >= W;
    const along = portrait ? H : W, cross = portrait ? W : H;
    const N = OLED_LAYERS.length, pad = along * 0.07, slot = (along - pad * 2) / N;
    const sq = Math.min(slot * 0.72, cross * 0.66);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${Math.round(sq * 0.5)}px "DM Sans", sans-serif`;
    for (let i = 0; i < N; i++) {
      const c = pad + slot * i + slot / 2;
      const cx = portrait ? cross / 2 : c, cy = portrait ? c : cross / 2;
      ctx.lineWidth = Math.max(2, sq * 0.09);
      roundRect(ctx, cx - sq / 2, cy - sq / 2, sq, sq, sq * 0.24);
      if (i === active) { ctx.fillStyle = OLED_CYAN; ctx.fill(); ctx.fillStyle = "#02070d"; ctx.fillText(String(i + 1), cx, cy + 1); ctx.fillStyle = OLED_CYAN; }
      else { ctx.globalAlpha = 0.55; ctx.stroke(); ctx.fillText(String(i + 1), cx, cy + 1); ctx.globalAlpha = 1; }
    }
  } else if (p === "boot") {
    // RP2040 boot screen with a loading bar (real OLEDs show a splash on power-up)
    ctx.textAlign = "left"; ctx.font = '700 11px monospace';
    ctx.fillText("CoryDora", 4, 9); ctx.font = '400 9px monospace'; ctx.fillText("RP2040 · QMK", 4, 19);
    const w = (Math.sin(t / 300) * 0.5 + 0.5) * (W - 8);
    ctx.lineWidth = 1; ctx.strokeRect(4, H - 7, W - 8, 4); ctx.fillRect(4, H - 7, w, 4);
  } else if (p === "swap") {
    // a live WPM meter - the classic keyboard OLED widget
    ctx.textAlign = "left"; ctx.font = '400 9px monospace'; ctx.fillText("WPM", 4, 9);
    const wpm = 58 + Math.round((Math.sin(t / 600) * 0.5 + 0.5) * 36);
    ctx.font = '700 20px monospace'; ctx.fillText(String(wpm), 4, H - 3);
    for (let i = 0; i < 16; i++) { const bh = (Math.sin(t / 170 + i * 0.6) * 0.5 + 0.5) * 22 + 3; ctx.fillRect(W - 4 - (16 - i) * 4, H - 3 - bh, 2, bh); }
  } else if (p === "case") {
    // status line - layer name + a small caps/lock style row
    ctx.textAlign = "left"; ctx.font = '700 12px monospace'; ctx.fillText("CoryDora", 4, 11);
    ctx.font = '400 9px monospace'; ctx.fillText("layout: ortho 3x3", 4, 24);
    ctx.strokeRect(W - 16, 4, 12, 8); // a little glyph
  } else if (p === "hello") {
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = '700 15px "Fraunces", serif';
    ctx.fillText("Hello!", 6, cy0);
  } else { // logo
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = '700 18px "Fraunces", serif';
    ctx.fillText("CoryDora", cx0, cy0);
  }
  o.tex.needsUpdate = true;
}

// ── floor "layer map": the active layer's app + a 3x3 key grid, on the right ──
function buildLayerMap() {
  const st = S.value; const sz = st?.modelSize; if (!st || !sz) return;
  const canvas = document.createElement("canvas"); canvas.width = 560; canvas.height = 720;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.92, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = FLOOR_TEXT_ROT; mesh.receiveShadow = true; mesh.renderOrder = 3; mesh.visible = false;
  st.scene.add(mesh);
  st.layerMap = { canvas, ctx: canvas.getContext("2d"), tex, mesh };
  applyLayerMapTune();
  drawLayerMap(0);
}
function applyLayerMapTune() {
  const st = S.value; const sz = st?.modelSize; if (!st?.layerMap || !sz) return;
  const m = st.layerMap.mesh;
  m.position.set(tune.mapX, 0.15, sz.z / 2 + tune.mapZ);
  m.scale.set(tune.mapH * (st.layerMap.canvas.width / st.layerMap.canvas.height), tune.mapH, 1);
}
function drawLayerMap(idx: number) {
  const lm = S.value?.layerMap; if (!lm) return;
  const L = OLED_LAYERS[idx]; const ctx = lm.ctx as CanvasRenderingContext2D;
  const W = lm.canvas.width, H = lm.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = "#ff9a5c"; (ctx as any).letterSpacing = "5px"; ctx.font = '800 28px "DM Sans", sans-serif';
  ctx.fillText(`EXAMPLE LAYER ${idx + 1}`, 26, 14);
  (ctx as any).letterSpacing = "0px"; ctx.fillStyle = "#faf3e8"; ctx.font = '800 54px "Fraunces", serif';
  ctx.fillText(L.app, 24, 50);

  // rotary encoder dial (it's an input too) - top-right, mirrors the device
  const dr = 44, dx = W - 26 - dr, dy = 78;
  ctx.strokeStyle = "rgba(250,243,232,0.6)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(dx, dy, dr * 0.5, -0.4, 2.0); ctx.stroke(); // little arc to read as a knob
  ctx.fillStyle = "#ff9a5c"; ctx.textAlign = "center"; ctx.font = '700 22px "DM Sans", sans-serif';
  ctx.fillText(`↻ ${L.enc}`, dx, dy + dr + 14);
  ctx.textAlign = "left";

  const gx = 60, gy = 175, gs = W - gx - 26, cell = gs / 3; // grid nudged in from the left
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const x = gx + c * cell, y = gy + r * cell;
    ctx.strokeStyle = "rgba(250,243,232,0.55)"; ctx.lineWidth = 3;
    roundRect(ctx, x + 6, y + 6, cell - 12, cell - 12, 16); ctx.stroke();
    ctx.fillStyle = "#e6ddcd"; ctx.font = '600 26px "DM Sans", sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(L.keys[r * 3 + c], x + cell / 2, y + cell / 2);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
  }
  lm.tex.needsUpdate = true;
}

// ── camera framing (aspect-aware so it fits on narrow / portrait screens) ──
function radiusOf(parts?: string[]): number {
  const st = S.value; const box = new THREE.Box3();
  const list = parts && parts.length ? parts.map((n) => st.meshes[n]).filter(Boolean) : Object.values(st.meshes);
  list.forEach((m: any) => box.expandByObject(m));
  return Math.max(box.getSize(new THREE.Vector3()).length() / 2, 18);
}
// distance needed to fit a sphere of radius r given the current vertical AND
// horizontal FOV - on a narrow viewport the horizontal FOV dominates, so we
// pull back rather than cropping the model.
function fitDistance(r: number): number {
  const st = S.value;
  const vfov = (st.camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * st.camera.aspect);
  return Math.max(r / Math.sin(vfov / 2), r / Math.sin(hfov / 2));
}
// keep the captured composition (angle + target) but never closer than what fits
type Cam = { pos: [number, number, number]; target: [number, number, number] };
function framedTo(cam: Cam, r: number) {
  const target = new THREE.Vector3(...cam.target);
  const dir = new THREE.Vector3(...cam.pos).sub(target);
  const hard = dir.length(); dir.normalize();
  const dist = Math.max(hard, fitDistance(r) * 1.12);
  return { pos: target.clone().add(dir.multiplyScalar(dist)), target };
}
function frameCam(cam: Cam, r: number) {
  const st = S.value; if (!st) return;
  st.controls.maxPolarAngle = PROG_MAX_POLAR; // let scripted frames dip lower
  const f = framedTo(cam, r);
  st.tween = { from: st.camera.position.clone(), to: f.pos, tFrom: st.controls.target.clone(), tTo: f.target, start: performance.now(), dur: 950 };
}
function frameBox(meshNames: string[]) { // for the customiser: a 3/4 angle on a part
  const st = S.value; if (!st) return;
  st.controls.maxPolarAngle = PROG_MAX_POLAR;
  const box = new THREE.Box3();
  meshNames.map((n) => st.meshes[n]).filter(Boolean).forEach((m: any) => box.expandByObject(m));
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 22);
  const dir = new THREE.Vector3(0.55, 0.5, 1).normalize();
  st.tween = { from: st.camera.position.clone(), to: c.clone().add(dir.multiplyScalar(fitDistance(r) * 1.2)),
    tFrom: st.controls.target.clone(), tTo: c.clone(), start: performance.now(), dur: 850 };
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
  updateFloorLabels(step);
  const r = radiusOf(step.show);
  st.controls.maxPolarAngle = PROG_MAX_POLAR;
  if (instant) { const f = framedTo(step.cam, r); st.camera.position.copy(f.pos); st.controls.target.copy(f.target); }
  else frameCam(step.cam, r);
}
function nextStep() { applyStep(tourIndex.value + 1); }
function prevStep() { applyStep(tourIndex.value - 1); }
// forward arrow stays put; on the final step it slides into Customise
function advance() {
  if (tourIndex.value >= TOUR.length - 1) enterCustomize();
  else nextStep();
}

function paint(name: string, m: any) { (m.material as THREE.MeshStandardMaterial).color.set(colorFor(name) as any); }
function restoreAll() {
  const st = S.value; if (!st) return;
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; paint(name, m); mat.needsUpdate = true;
    if (st.edges[name]) st.edges[name].visible = false;
  }
}
function showOnly(meshNames: string[]) {
  const st = S.value; if (!st) return;
  const set = new Set(meshNames);
  for (const [name, m] of Object.entries<any>(st.meshes)) {
    const mat = m.material as THREE.MeshStandardMaterial;
    if (set.has(name)) {
      mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; paint(name, m);
      if (st.edges[name]) st.edges[name].visible = false;
    } else {
      mat.transparent = true; mat.opacity = 0.04; mat.depthWrite = false;
      if (st.edges[name]) st.edges[name].visible = true;
    }
    mat.needsUpdate = true;
  }
}

// A momentary "x-ray glimpse": smoothly fade the OUTER parts out and back over a
// short pulse so you can peek at an internal part you just changed (switches /
// gasket). The changed part is left alone so its colour tween keeps playing.
// The actual fade is driven in the render loop (st.flash).
function flashPart(keep: string[]) {
  const st = S.value; if (!st) return;
  st.flash = { keep: new Set(keep), start: performance.now(), dur: 750 };
}

function enterTour() { mode.value = "tour"; if (S.value) { S.value.insertActive = false; S.value.pressActive = false; } applyStep(tourIndex.value); }
function enterCustomize() {
  mode.value = "customize";
  if (S.value) { S.value.insertActive = false; S.value.pressActive = false; if (S.value.dims) S.value.dims.visible = false; }
  setFloorLabels([]); // no floor annotations while customising
  selectPart(activePart.value);
}
function selectPart(id: string) {
  activePart.value = id;
  const part = PARTS.find((p) => p.id === id)!;
  showOnly(part.meshes); frameBox(part.meshes);
}
function pickColor(id: string, color: string) {
  chosen.value = { ...chosen.value, [id]: color };
  const part = PARTS.find((p) => p.id === id); const st = S.value; if (!part || !st) return;
  const to = new THREE.Color(color);
  for (const mn of part.meshes) {
    const m = st.meshes[mn]; if (!m) continue;
    const mat = m.material as THREE.MeshStandardMaterial;
    st.colorTweens = (st.colorTweens || []).filter((tw: any) => tw.mat !== mat); // replace any in-flight tween
    st.colorTweens.push({ mat, from: mat.color.clone(), to: to.clone(), start: performance.now(), dur: 340 });
  }
}

// ── debug ──
function copyFrame() {
  const d = dbg.value;
  const key = debugPhone.value ? "camMobile" : "cam";
  // ready to paste into the scene, with the human-readable angles as a trailing comment
  const snippet = `${key}: { pos: [${d.px}, ${d.py}, ${d.pz}], target: [${d.tx}, ${d.ty}, ${d.tz}] }, // az ${d.az}°, polar ${d.polar}°, dist ${d.dist}`;
  navigator.clipboard?.writeText(snippet);
}

onBeforeUnmount(() => {
  disposed = true; const st = S.value; if (!st) return;
  cancelAnimationFrame(st.raf); st._ro?.disconnect?.(); st._io?.disconnect?.();
  if (st._onClick) st.renderer.domElement.removeEventListener("click", st._onClick);
  if (st._onFs) document.removeEventListener("fullscreenchange", st._onFs);
  st.controls.dispose(); st.composer.dispose?.(); st.renderer.dispose(); st.renderer.domElement.remove();
});
</script>

<template>
  <div class="mx-wrap">
    <div class="mx-stage" :class="{ 'mx-stage--page': variant === 'page' }" ref="canvasWrap">
      <div class="mx-vignette"></div>
      <div v-if="loading" class="mx-overlay">Loading 3D model…</div>
      <div v-else-if="failed" class="mx-overlay">3D preview unavailable on this device.</div>

      <!-- top-left: mode toggle (hidden when a parent island owns the UI) -->
      <div v-if="!embedded" class="mx-ui mx-ui--tl">
        <button class="mx-mode" :class="{ active: mode === 'tour' }" @click="enterTour"><i class="ph-bold ph-presentation"></i> Tour</button>
        <button class="mx-mode" :class="{ active: mode === 'customize' }" @click="enterCustomize"><i class="ph-bold ph-paint-brush-broad"></i> Customise</button>
      </div>

      <!-- top-right: fullscreen + cinematic + debug toggles -->
      <div v-if="!embedded" class="mx-ui mx-ui--tr">
        <button class="mx-mini" @click="toggleFullscreen" :title="isFs ? 'Exit full screen' : 'Full screen'"><i :class="isFs ? 'ph-bold ph-arrows-in' : 'ph-bold ph-arrows-out'"></i></button>
        <button class="mx-mini" :class="{ active: modeIndex > 0 }" @click="cycleMode" :title="`View: ${MODES[modeIndex].label} - tap for more`"><i class="ph-bold ph-magic-wand"></i></button>
        <button class="mx-mini" :class="{ active: debugOn }" @click="debugOn = !debugOn" title="Camera debug"><i class="ph-bold ph-bug"></i></button>
      </div>

      <!-- bottom overlay: tour text + nav, or customise controls -->
      <template v-if="!embedded">
      <div v-if="mode === 'tour'" class="mx-ui mx-ui--bottom">
        <div v-if="panelOpen" class="mx-step">
          <button class="mx-step-close" @click="panelOpen = false" aria-label="Close info"><i class="ph-bold ph-x"></i></button>
          <div class="mx-step-count">{{ tourIndex + 1 }} / {{ TOUR.length }}</div>
          <h3 class="mx-step-title">{{ TOUR[tourIndex].title }}</h3>
          <p class="mx-step-text">{{ TOUR[tourIndex].body }}</p>
        </div>
        <button v-else class="mx-reopen" @click="panelOpen = true"><i class="ph-bold ph-info"></i> {{ TOUR[tourIndex].title }}</button>
        <div class="mx-nav">
          <button class="mx-nav-btn" @click="prevStep"><i class="ph-bold ph-caret-left"></i></button>
          <button class="mx-nav-btn" @click="advance"><i class="ph-bold ph-caret-right"></i></button>
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
      </template>

      <!-- debug sidebar -->
      <div v-if="debugOn" class="mx-debug">
        <div class="mx-debug-h">Camera <button class="mx-debug-x" @click="debugOn = false">×</button></div>
        <div class="mx-debug-seg">
          <button :class="{ active: !debugPhone }" @click="debugPhone = false">Desktop</button>
          <button :class="{ active: debugPhone }" @click="debugPhone = true">Phone</button>
        </div>
        <dl>
          <div><dt>azimuth</dt><dd>{{ dbg.az }}°</dd></div>
          <div><dt>polar</dt><dd>{{ dbg.polar }}°</dd></div>
          <div><dt>distance</dt><dd>{{ dbg.dist }}</dd></div>
          <div><dt>pos</dt><dd>{{ dbg.px }}, {{ dbg.py }}, {{ dbg.pz }}</dd></div>
          <div><dt>target</dt><dd>{{ dbg.tx }}, {{ dbg.ty }}, {{ dbg.tz }}</dd></div>
        </dl>
        <button class="mx-debug-copy" @click="copyFrame"><i class="ph-bold ph-copy"></i> Copy frame</button>

        <div class="mx-debug-h" style="margin-top:0.6rem;">Floor tuner</div>
        <div class="mx-tune">
          <label>panel x<input type="number" v-model.number="tune.panelX" /></label>
          <label>panel z<input type="number" v-model.number="tune.panelZ" /></label>
          <label>logo x<input type="number" v-model.number="tune.logoX" /></label>
          <label>logo z<input type="number" v-model.number="tune.logoZ" /></label>
          <label>logo size<input type="number" v-model.number="tune.logoSize" /></label>
          <label>oled x<input type="number" step="0.5" v-model.number="tune.oledX" /></label>
          <label>oled y<input type="number" step="0.5" v-model.number="tune.oledY" /></label>
          <label>oled z<input type="number" step="0.5" v-model.number="tune.oledZ" /></label>
          <label>oled rot°<input type="number" step="5" v-model.number="tune.oledRot" /></label>
          <label>oled w<input type="number" step="0.5" v-model.number="tune.oledW" /></label>
          <label>oled h<input type="number" step="0.5" v-model.number="tune.oledH" /></label>
          <label>map x<input type="number" step="2" v-model.number="tune.mapX" /></label>
          <label>map z<input type="number" step="2" v-model.number="tune.mapZ" /></label>
          <label>map h<input type="number" step="4" v-model.number="tune.mapH" /></label>
        </div>
        <button class="mx-debug-copy" @click="copyTune"><i class="ph-bold ph-copy"></i> Copy tune</button>
        <p class="mx-debug-hint">Copying for <b>{{ debugPhone ? 'phone' : 'desktop' }}</b> - frame copies as <code>{{ debugPhone ? 'camMobile' : 'cam' }}</code>. Drag the model or edit live, then paste to me.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mx-wrap { width: 100%; }
.mx-stage { position: relative; width: 100%; height: 480px; border-radius: 0.75rem; overflow: hidden; background: #12141a; }
.mx-stage:fullscreen { height: 100vh; max-height: none; border-radius: 0; }
.mx-stage--page { height: 100svh; min-height: 100vh; border-radius: 0; }
@media (max-width: 640px) {
  .mx-stage { height: 78vw; min-height: 320px; max-height: 460px; }
  .mx-stage--page { height: 90svh; min-height: 90svh; max-height: none; } /* 90% on phone - dodges the address bar */
  .mx-ui--tl, .mx-ui--tr { top: 8px; }
  .mx-ui--tl { left: 8px; gap: 0.25rem; }
  .mx-ui--tr { right: 8px; }
  .mx-ui--bottom { left: 8px; right: 8px; bottom: 8px; gap: 0.5rem; }
  .mx-mode { padding: 0.32rem 0.6rem; font-size: 0.72rem; }
  .mx-step { max-width: none; padding: 0.55rem 0.7rem; }
  .mx-step-title { font-size: 0.9rem; }
  .mx-step-text { font-size: 0.72rem; }
  .mx-nav-btn { width: 34px; height: 34px; }
  /* keep part tabs on one scrollable row instead of wrapping over the model */
  .mx-parts { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
  .mx-parts::-webkit-scrollbar { display: none; }
  .mx-part-tab { flex: 0 0 auto; }
  .mx-debug { width: 160px; font-size: 0.66rem; }
  .mx-scale { font-size: 0.58rem; top: 8px; padding: 0.18rem 0.5rem; }
}
.mx-vignette { position: absolute; inset: 0; pointer-events: none; z-index: 2;
  background: radial-gradient(ellipse 75% 75% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%); }
.mx-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; color: #cbb89a; pointer-events: none; z-index: 3; }
.mx-anno { position: absolute; transform: translate(-50%, -150%); z-index: 3; background: rgba(10,10,12,0.9); color: #faf3e8; font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.5rem; border-radius: 999px; white-space: nowrap; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
.mx-scale { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 4; display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(10,10,12,0.55); color: #faf3e8; font-size: 0.66rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 999px; pointer-events: none; backdrop-filter: blur(6px); }

.mx-ui { position: absolute; z-index: 4; }
.mx-ui--tl { top: 10px; left: 10px; display: flex; gap: 0.35rem; }
.mx-ui--tr { top: 10px; right: 10px; display: flex; gap: 0.35rem; }
.mx-ui--bottom { left: 10px; right: 10px; bottom: 10px; display: flex; align-items: flex-end; justify-content: space-between; gap: 0.75rem; }

.mx-mode { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.8rem; border-radius: 999px; border: 1.5px solid rgba(255,255,255,0.16); background: rgba(10,10,12,0.55); color: #f3ece0; font-size: 0.78rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.15s; }
.mx-mode:hover { border-color: rgba(255,255,255,0.4); }
.mx-mode.active { border-color: #ff6c1e; background: #ff6c1e; color: #11131a; }
.mx-mini { width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.16); background: rgba(10,10,12,0.55); color: #f3ece0; cursor: pointer; backdrop-filter: blur(8px); }
.mx-mini.active { border-color: #ff6c1e; color: #ff6c1e; }

.mx-step { position: relative; flex: 1 1 0; min-width: 0; background: rgba(10,10,12,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.7rem; padding: 0.7rem 0.9rem; backdrop-filter: blur(10px); max-width: 420px; }
.mx-step-close { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 999px; background: rgba(255,255,255,0.1); color: #d7cdbd; font-size: 0.6rem; cursor: pointer; transition: background 0.15s, color 0.15s; }
.mx-step-close:hover { background: #ff6c1e; color: #11131a; }
.mx-reopen { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.8rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(10,10,12,0.6); color: #f3ece0; font-size: 0.78rem; font-weight: 700; cursor: pointer; backdrop-filter: blur(10px); max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mx-reopen:hover { border-color: #ff6c1e; color: #ff9a5c; }
.mx-step-count { font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #ff9a5c; }
.mx-step-title { font-family: "Fraunces", serif; font-weight: 700; font-size: 1rem; color: #faf3e8; margin: 0.1rem 0 0.15rem; }
.mx-step-text { font-size: 0.78rem; color: #d7cdbd; line-height: 1.45; }
.mx-nav { display: flex; gap: 0.4rem; flex-shrink: 0; }
.mx-nav-btn { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.18); background: rgba(10,10,12,0.6); color: #faf3e8; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); transition: all 0.15s; }
.mx-nav-btn:hover { border-color: #ff6c1e; color: #ff6c1e; }
.mx-cta { display: inline-flex; align-items: center; gap: 0.35rem; height: 38px; padding: 0 0.9rem; border-radius: 999px; border: none; background: #ff6c1e; color: #11131a; font-size: 0.78rem; font-weight: 800; cursor: pointer; white-space: nowrap; }
.mx-cta:hover { background: #ff7d33; }

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
.mx-debug-seg { display: flex; gap: 2px; margin-bottom: 0.5rem; background: rgba(255,255,255,0.07); border-radius: 6px; padding: 2px; }
.mx-debug-seg button { flex: 1; border: none; background: transparent; color: #cdbfa6; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.25rem; border-radius: 4px; cursor: pointer; }
.mx-debug-seg button.active { background: #ff7a1a; color: #1a1a1a; }
.mx-debug-x { background: none; border: none; color: #e7ddca; font-size: 1rem; cursor: pointer; line-height: 1; }
.mx-debug dl { display: flex; flex-direction: column; gap: 0.2rem; margin: 0; }
.mx-debug dl > div { display: flex; justify-content: space-between; gap: 0.5rem; font-variant-numeric: tabular-nums; }
.mx-debug dt { color: #9a8f7c; }
.mx-debug dd { margin: 0; font-weight: 600; }
.mx-debug-copy { margin-top: 0.5rem; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.35rem; border-radius: 0.45rem; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,108,30,0.15); color: #ffb486; font-size: 0.7rem; font-weight: 700; cursor: pointer; }
.mx-debug-hint { margin-top: 0.4rem; font-size: 0.6rem; color: #8f8674; line-height: 1.35; }
.mx-tune { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 0.4rem; margin-top: 0.35rem; }
.mx-tune label { display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; font-size: 0.6rem; color: #b8ab93; }
.mx-tune input { width: 3.2rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.25rem; color: #faf3e8; font-size: 0.62rem; padding: 0.1rem 0.25rem; }
</style>
