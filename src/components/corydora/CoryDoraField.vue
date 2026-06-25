<script setup lang="ts">
/**
 * CoryDoraField - an ambient "sea" of CoryDoras for the page footer. No interaction,
 * just a slow drift over a staggered plane, each unit in its own Numakers colourway,
 * with a live OLED glowing on top playing a random little widget.
 *
 * Super-optimised: GPU instancing (one InstancedMesh per visible part → ~5 draw
 * calls), exterior parts only (the 82k-vert interior is dropped), per-instance
 * colour, static instances. The OLEDs share a small POOL of animated widget textures
 * (instances grouped by widget + phase) instead of one canvas each - so hundreds of
 * screens cost a handful of canvas redraws per frame. Fog, no shadows, no env map.
 */
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { PARTS } from "../../data/corydora-parts";
import { drawScreen } from "../../lib/corydora-screens";

const props = defineProps<{ src: string }>();

const wrap = ref<HTMLDivElement | null>(null);
const loading = ref(true);
let disposed = false;
let liveId = 0;                       // invalidates in-flight model loads across rebuilds
let release: (() => void) | null = null;
const disposers: (() => void)[] = [];

const FIELD_MESHES: Record<string, string> = {
    backplate: "body",
    frontplate: "body",
    trim: "trim",
    keycaps: "keycaps",
    knob: "knob",
};
function palette(id: string): string[] {
    return (PARTS.find((p) => p.id === id)?.options ?? []).map((o) => o.color);
}

const SWAY_AMP = 20,
    SWAY_SPEED = 0.65; // gentle horizontal row drift (alternating rows opposite)

// ── cassette-tech ground (ported from ModelExperience): dark-blue square grid ──
function cassetteTexture(repeat: number): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#161922";
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = "rgba(120,205,215,0.16)";
    x.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i, 512);
        x.stroke();
        x.beginPath();
        x.moveTo(0, i);
        x.lineTo(512, i);
        x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function radialAlpha(): THREE.Texture {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(128, 128, 16, 128, 128, 128);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.65, "#888");
    g.addColorStop(1, "#000");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

onMounted(() => {
    const el = wrap.value;
    if (!el) return;
    let built = false;
    let onscreen = true;
    let teardownTimer: ReturnType<typeof setTimeout> | undefined;

    // Fully release the WebGL context + GPU memory when scrolled away (not just pause
    // the loop), so the footer stops eating RAM while you're up at the story. Rebuilds
    // (re-loads the cached GLB) when it scrolls back into view.
    const teardown = () => {
        if (!built) return;
        built = false; liveId++; // invalidate any in-flight model load
        disposers.forEach((d) => d());
        disposers.length = 0;
        loading.value = true;
    };
    const build = () => {
        if (built || disposed) return;
        built = true;
        const myId = ++liveId;
    const isPhone = window.matchMedia("(max-width: 720px)").matches;
    const COUNT = isPhone ? 36 : 36; // +25% density

    let renderer: THREE.WebGLRenderer;
    try {
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
        });
    } catch {
        loading.value = false;
        return;
    }
    const w = el.clientWidth || 800,
        h = el.clientHeight || 500;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    renderer.toneMapping = THREE.NeutralToneMapping; // match the viewer's punchy Studio look (AgX washed it out)
    renderer.toneMappingExposure = 0.98;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, {
        display: "block",
        width: "100%",
        height: "100%",
    });
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12141a);
    scene.fog = new THREE.FogExp2(0x12141a, 0.0005);

    const camera = new THREE.PerspectiveCamera(
        isPhone ? 40 : 24,
        w / h,
        1,
        12000,
    ); // desktop zoomed in further

    // lighting rig mirrored from the viewer's Studio look: warm key + hemisphere lift +
    // cool fill + faint colour rims (strong rims were tinting/washing the colours)
    const key = new THREE.DirectionalLight(0xfff3e2, 1.7);
    key.position.set(150, 300, 170);
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xf3e6cf, 0x14161c, 0.7));
    const fill = new THREE.DirectionalLight(0xaec6ff, 0.5);
    fill.position.set(-160, 80, -30);
    scene.add(fill);
    const rimA = new THREE.DirectionalLight(0xff8a45, 0.12);
    rimA.position.set(120, 40, -200);
    scene.add(rimA);
    const rimB = new THREE.DirectionalLight(0x49d6de, 0.08);
    rimB.position.set(-150, 30, -160);
    scene.add(rimB);

    // same soft studio HDR the main viewer uses - its smooth gradient reflects cleanly
    // off the flat case panels (RoomEnvironment's hard light strips warped them).
    new RGBELoader().load("/hdr/studio.hdr", (hdr) => {
        if (disposed || myId !== liveId) return;
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const env = pmrem.fromEquirectangular(hdr).texture;
        scene.environment = env;
        hdr.dispose();
        pmrem.dispose();
        disposers.push(() => env.dispose());
    });

    const cols = Math.round(Math.sqrt(COUNT));
    const rows = Math.ceil(COUNT / cols);
    const SP = isPhone ? 167 : 216; // tighter packing (denser)
    const spanX = (cols - 1) * SP,
        spanZ = (rows - 1) * SP;

    // the viewer's cassette-tech ground: dark-blue square grid, edges faded to the bg
    const Rg = Math.max(spanX, spanZ) * 0.85 + 1500;
    const groundMap = cassetteTexture(Math.max(10, Math.round(Rg / 150)));
    const groundAlpha = radialAlpha();
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0.1,
        map: groundMap,
        transparent: true,
        alphaMap: groundAlpha,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(Rg, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);
    disposers.push(() => {
        ground.geometry.dispose();
        groundMat.dispose();
        groundMap.dispose();
        groundAlpha.dispose();
    });

    // camera control: drag to look around; gently auto-rotates when idle. Wheel-zoom +
    // pan are off so scrolling the page past the footer isn't trapped by the canvas.
    camera.position.set(spanX * 0.12, 650, spanZ * 0.55);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(280, -100, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.maxPolarAngle = 1.28; // stay above the floor
    // let vertical touch-swipes scroll the page; horizontal drag still orbits
    renderer.domElement.style.touchAction = "pan-y";
    controls.update();
    disposers.push(() => controls.dispose());

    // per-instance row sway: alternate rows drift horizontally opposite ways
    let partMeshes: THREE.InstancedMesh[] = [];
    let oledAnim: {
        im: THREE.InstancedMesh;
        members: number[];
        baseX: Float32Array;
    }[] = [];
    const rowSign = new Float32Array(COUNT),
        baseX = new Float32Array(COUNT);
    // live OLED screens (redrawn at a throttled rate for animation)
    const screens: {
        ctx: CanvasRenderingContext2D;
        tex: THREE.CanvasTexture;
        seed: number;
        phase: number;
    }[] = [];
    let lastOled = 0;

    const draco = new DRACOLoader().setDecoderPath("/draco/");
    new GLTFLoader().setDRACOLoader(draco).load(
        props.src,
        (gltf) => {
            if (disposed || myId !== liveId) return; // torn down / rebuilt while loading

            const parts: { name: string; geo: THREE.BufferGeometry }[] = [];
            const box = new THREE.Box3();
            gltf.scene.traverse((o: any) => {
                if (!o.isMesh) return;
                const name = o.name.replace(/-Mesh$/, "").toLowerCase();
                if (!(name in FIELD_MESHES)) return;
                const g = o.geometry as THREE.BufferGeometry;
                if (!g.getAttribute("normal")) g.computeVertexNormals();
                g.computeBoundingBox();
                box.union(g.boundingBox!);
                parts.push({ name, geo: g });
            });
            const c = box.getCenter(new THREE.Vector3()),
                minY = box.min.y;
            parts.forEach((p) => {
                const g = p.geo.clone();
                g.translate(-c.x, -minY, -c.z);
                p.geo = g;
            });

            const pal = {
                body: palette("body"),
                trim: palette("trim"),
                keycaps: palette("keycaps"),
                knob: palette("knob"),
            };
            const mats: Record<string, string[]> = {
                body: [],
                trim: [],
                keycaps: [],
                knob: [],
            };
            const mtx: THREE.Matrix4[] = [];
            const m4 = new THREE.Matrix4(),
                q = new THREE.Quaternion(),
                pos = new THREE.Vector3(),
                scl = new THREE.Vector3(1, 1, 1);
            const pick = (a: string[]) => a[(Math.random() * a.length) | 0];
            for (let i = 0; i < COUNT; i++) {
                const gx = i % cols,
                    gz = Math.floor(i / cols);
                const stagger = (gz % 2) * (SP * 0.5);
                pos.set(
                    (gx - (cols - 1) / 2) * SP + stagger,
                    0,
                    (gz - (rows - 1) / 2) * SP,
                );
                mtx.push(m4.compose(pos, q, scl).clone());
                for (const k of Object.keys(pal) as (keyof typeof pal)[])
                    mats[k].push(pick(pal[k]));
            }

            // macropad parts
            const col = new THREE.Color();
            const meshes: THREE.InstancedMesh[] = [];
            for (const p of parts) {
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.55,
                    metalness: 0.05,
                    envMapIntensity: 1.1, // match the viewer (soft studio HDR, Neutral tonemap)
                });
                const im = new THREE.InstancedMesh(p.geo, mat, COUNT);
                im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                im.frustumCulled = false;
                const part = FIELD_MESHES[p.name];
                for (let i = 0; i < COUNT; i++) {
                    im.setMatrixAt(i, mtx[i]);
                    im.setColorAt(i, col.set(mats[part][i]));
                }
                im.instanceMatrix.needsUpdate = true;
                if (im.instanceColor) im.instanceColor.needsUpdate = true;
                scene.add(im);
                meshes.push(im);
            }
            partMeshes = meshes;
            for (let i = 0; i < COUNT; i++) {
                rowSign[i] = Math.floor(i / cols) % 2 === 0 ? 1 : -1;
                baseX[i] = mtx[i].elements[12];
            }

            // OLED screens: pool of animated widgets, instances grouped by (widget, phase)
            const OLED_POS = new THREE.Vector3(30, 20, -10);
            const oledLocal = new THREE.Matrix4().compose(
                OLED_POS,
                new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2),
                ),
                new THREE.Vector3(38, 9.5, 1),
            );
            // unique generative screens, pooled to bound OLED draw calls
            const POOL = Math.min(18, COUNT);
            const groups = Array.from({ length: POOL }, () => ({
                members: [] as number[],
                seed: (Math.random() * 1e9) | 0,
                phase: Math.random() * 12,
            }));
            for (let i = 0; i < COUNT; i++)
                groups[(Math.random() * POOL) | 0].members.push(i);
            const planeGeo = new THREE.PlaneGeometry(1, 1);
            const oledMeshes: THREE.InstancedMesh[] = [];
            const oledAnimArr: {
                im: THREE.InstancedMesh;
                members: number[];
                baseX: Float32Array;
            }[] = [];
            const tmp = new THREE.Matrix4();
            for (const grp of groups) {
                if (!grp.members.length) continue;
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 32;
                const ctx = canvas.getContext("2d")!;
                const tex = new THREE.CanvasTexture(canvas);
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                const mat = new THREE.MeshBasicMaterial({
                    map: tex,
                    toneMapped: false,
                });
                const im = new THREE.InstancedMesh(
                    planeGeo,
                    mat,
                    grp.members.length,
                );
                im.frustumCulled = false;
                im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                const obx = new Float32Array(grp.members.length);
                grp.members.forEach((idx, j) => {
                    tmp.multiplyMatrices(mtx[idx], oledLocal);
                    im.setMatrixAt(j, tmp);
                    obx[j] = tmp.elements[12];
                });
                im.instanceMatrix.needsUpdate = true;
                im.renderOrder = 2;
                scene.add(im);
                oledMeshes.push(im);
                drawScreen(ctx, 128, 32, grp.seed, 0);
                tex.needsUpdate = true;
                screens.push({ ctx, tex, seed: grp.seed, phase: grp.phase });
                oledAnimArr.push({ im, members: grp.members, baseX: obx });
            }
            oledAnim = oledAnimArr;

            loading.value = false;
            disposers.push(() => {
                meshes.forEach((im) => {
                    im.geometry.dispose();
                    (im.material as THREE.Material).dispose();
                    im.dispose();
                });
                oledMeshes.forEach((im) => {
                    (im.material as THREE.MeshBasicMaterial).map?.dispose();
                    (im.material as THREE.Material).dispose();
                    im.dispose();
                });
                planeGeo.dispose();
            });
        },
        undefined,
        () => {
            loading.value = false;
        },
    );

    const ro = new ResizeObserver(() => {
        const ww = el.clientWidth,
            hh = el.clientHeight;
        if (!ww || !hh) return;
        camera.aspect = ww / hh;
        camera.updateProjectionMatrix();
        renderer.setSize(ww, hh);
    });
    ro.observe(el);

    let raf = 0;
    function loop() {
        raf = requestAnimationFrame(loop);
        if (!onscreen) return;
        const now = performance.now(),
            t = now / 1000;
        controls.update(); // damping + idle auto-rotate, and user drag
        // gentle row sway: shift each instance's X by its row's signed sine (parts + OLEDs)
        const S = SWAY_AMP * Math.sin(t * SWAY_SPEED);
        for (const im of partMeshes) {
            const arr = im.instanceMatrix.array as Float32Array;
            for (let i = 0; i < COUNT; i++)
                arr[i * 16 + 12] = baseX[i] + rowSign[i] * S;
            im.instanceMatrix.needsUpdate = true;
        }
        for (const od of oledAnim) {
            const arr = od.im.instanceMatrix.array as Float32Array;
            for (let j = 0; j < od.members.length; j++)
                arr[j * 16 + 12] = od.baseX[j] + rowSign[od.members[j]] * S;
            od.im.instanceMatrix.needsUpdate = true;
        }
        if (now - lastOled > 100) {
            // ~10fps screen refresh - the generative widgets animate again
            lastOled = now;
            for (const s of screens) {
                drawScreen(s.ctx, 128, 32, s.seed, t + s.phase);
                s.tex.needsUpdate = true;
            }
        }
        renderer.render(scene, camera);
    }
    loop();

    disposers.push(() => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.dispose();
        renderer.domElement.remove();
    });
    }; // end build()

    // persistent: build on (re)enter, release the GPU context ~3s after leaving view
    const io = new IntersectionObserver(
        (es) => {
            onscreen = es[0].isIntersecting;
            if (onscreen) {
                clearTimeout(teardownTimer);
                build();
            } else {
                clearTimeout(teardownTimer);
                teardownTimer = setTimeout(teardown, 3000);
            }
        },
        { threshold: 0 },
    );
    io.observe(el);
    build(); // client:visible → mounted because in view
    release = () => {
        clearTimeout(teardownTimer);
        io.disconnect();
        teardown();
    };
});

onBeforeUnmount(() => {
    disposed = true;
    release?.();
});
</script>

<template>
    <div class="cf">
        <div class="cf-stage" ref="wrap"></div>
        <div class="cf-top"></div>
    </div>
</template>

<style scoped>
.cf {
    position: relative;
    width: 100%;
    height: 68svh;
    min-height: 360px;
    background: #12141a;
    overflow: hidden;
}
.cf-stage {
    position: absolute;
    inset: 0;
}
/* fade the top edge into the page above */
.cf-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 28%;
    pointer-events: none;
    background: linear-gradient(
        to bottom,
        #12141a 0%,
        rgba(18, 20, 26, 0) 100%
    );
}
</style>
