<script setup lang="ts">
/**
 * Open Source Files - click any file to preview it in a modal and
 * download it. Previews adapt to the format: code (KiCad/C), CSV as a
 * table, PDF embed, 3D via model-viewer, images. Downloads are logged
 * to the local store as an interest signal.
 *
 * This is where the open-source promise becomes tangible - you can
 * actually read the firmware and inspect the BOM before you back it.
 */
import { ref, computed } from "vue";
import { logDownload } from "../lib/store";

type FileType = "code" | "csv" | "pdf" | "3d" | "image" | "text";

interface SourceFile {
  name: string;
  format: string;
  icon: string;
  type: FileType;
  filename: string;
  content?: string;
  url?: string;
  modelUrl?: string;
  language?: string;
  meta?: string;
}

const props = defineProps<{
  files: SourceFile[];
  campaignSlug: string;
  license: string;
}>();

const active = ref<SourceFile | null>(null);
const modelLoaded = ref(false);

function open(file: SourceFile) {
  active.value = file;
  document.documentElement.style.overflow = "hidden";
  if (file.type === "3d") ensureModelViewer();
}
function close() {
  active.value = null;
  document.documentElement.style.overflow = "";
}

function ensureModelViewer() {
  if (modelLoaded.value || document.querySelector('script[data-model-viewer]')) {
    modelLoaded.value = true;
    return;
  }
  const s = document.createElement("script");
  s.type = "module";
  s.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0/model-viewer.min.js";
  s.setAttribute("data-model-viewer", "");
  document.head.appendChild(s);
  modelLoaded.value = true;
}

// CSV -> rows for table rendering
const csvRows = computed(() => {
  if (!active.value || active.value.type !== "csv" || !active.value.content) return [];
  return active.value.content
    .trim()
    .split("\n")
    .map((line) => line.split(",").map((c) => c.trim()));
});

function download(file: SourceFile) {
  logDownload({ campaignSlug: props.campaignSlug, fileName: file.name, fileFormat: file.format });
  if (file.content != null) {
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (file.url || file.modelUrl) {
    const a = document.createElement("a");
    a.href = (file.url || file.modelUrl) as string;
    a.download = file.filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
</script>

<template>
  <div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button v-for="file in files" :key="file.name" class="fp-card" @click="open(file)">
        <div class="fp-card-icon"><i :class="file.icon"></i></div>
        <div class="flex-1 min-w-0 text-left">
          <div class="text-sm font-semibold leading-snug truncate">{{ file.name }}</div>
          <div class="text-xs text-ink-faint">{{ file.format }}</div>
        </div>
        <i class="ph-bold ph-eye fp-card-eye"></i>
      </button>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <Transition name="fp-fade">
        <div v-if="active" class="fp-backdrop" @click.self="close">
          <div class="fp-modal">
            <div class="fp-head">
              <div class="flex items-center gap-2.5 min-w-0">
                <i :class="active.icon" class="text-stencil" style="font-size:1.1rem;"></i>
                <div class="min-w-0">
                  <div class="font-serif font-bold text-sm leading-tight truncate">{{ active.name }}</div>
                  <div class="text-[0.65rem] text-ink-faint">{{ active.filename }} · {{ license }}</div>
                </div>
              </div>
              <button class="fp-close" @click="close" aria-label="Close"><i class="ph-bold ph-x"></i></button>
            </div>

            <div class="fp-body">
              <!-- code / text -->
              <pre v-if="active.type === 'code' || active.type === 'text'" class="fp-code"><code>{{ active.content }}</code></pre>

              <!-- csv table -->
              <div v-else-if="active.type === 'csv'" class="fp-csv-wrap">
                <table class="fp-csv">
                  <thead>
                    <tr><th v-for="(h, i) in csvRows[0]" :key="i">{{ h }}</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, ri) in csvRows.slice(1)" :key="ri">
                      <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- pdf -->
              <iframe v-else-if="active.type === 'pdf' && active.url" :src="active.url" class="fp-frame" title="PDF preview"></iframe>

              <!-- 3d -->
              <model-viewer
                v-else-if="active.type === '3d' && active.modelUrl"
                :src="active.modelUrl"
                camera-controls
                auto-rotate
                shadow-intensity="1"
                class="fp-3d"
              ></model-viewer>

              <!-- image -->
              <img v-else-if="active.type === 'image' && active.url" :src="active.url" :alt="active.name" class="fp-img" />

              <!-- fallback -->
              <div v-else class="fp-fallback">
                <i :class="active.icon"></i>
                <p>Preview isn't available for this format.<br />Download it to open in your tools.</p>
              </div>
            </div>

            <div class="fp-foot">
              <span class="text-xs text-ink-faint">{{ active.meta || active.format }}</span>
              <button class="btn btn-stamp btn-sm" @click="download(active)">
                <i class="ph-bold ph-download-simple mr-1.5"></i>Download
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fp-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.625rem;
  border: 1.5px solid rgba(26, 26, 26, 0.08);
  background: rgba(250, 243, 232, 0.4);
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
  width: 100%;
}
.fp-card:hover {
  border-color: #d94800;
  background: rgba(217, 72, 0, 0.04);
}
.fp-card-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 26, 0.05);
  color: #6b5b4a;
  font-size: 1.1rem;
  flex-shrink: 0;
  transition: color 0.15s;
}
.fp-card:hover .fp-card-icon { color: #d94800; }
.fp-card-eye { color: #b8a589; flex-shrink: 0; transition: color 0.15s; }
.fp-card:hover .fp-card-eye { color: #d94800; }

.fp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(26, 26, 26, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.fp-modal {
  background: #faf3e8;
  border-radius: 1rem;
  width: 100%;
  max-width: 760px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(26, 26, 26, 0.3);
}
.fp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(26, 26, 26, 0.08);
  flex-shrink: 0;
}
.fp-close {
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  border: none;
  background: rgba(26, 26, 26, 0.05);
  color: #1a1a1a;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.fp-close:hover { background: #1a1a1a; color: #faf3e8; }
.fp-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #f3ead9;
}
.fp-code {
  margin: 0;
  padding: 1rem 1.1rem;
  font-family: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.6;
  color: #2a2a2a;
  white-space: pre;
  tab-size: 2;
}
.fp-csv-wrap { overflow: auto; }
.fp-csv {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.fp-csv th,
.fp-csv td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(26, 26, 26, 0.08);
  white-space: nowrap;
}
.fp-csv th {
  position: sticky;
  top: 0;
  background: #ece0cc;
  font-weight: 700;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #4a3d2f;
}
.fp-csv tbody tr:nth-child(even) { background: rgba(26, 26, 26, 0.02); }
.fp-frame { width: 100%; height: 60vh; border: none; background: #fff; }
.fp-3d { width: 100%; height: 60vh; display: block; background: #ece0cc; }
.fp-img { width: 100%; height: auto; display: block; }
.fp-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
  color: #6b5b4a;
  min-height: 240px;
}
.fp-fallback i { font-size: 2.5rem; opacity: 0.5; }
.fp-fallback p { font-size: 0.85rem; line-height: 1.5; }
.fp-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(26, 26, 26, 0.08);
  flex-shrink: 0;
}

.fp-fade-enter-active,
.fp-fade-leave-active { transition: opacity 0.2s ease; }
.fp-fade-enter-from,
.fp-fade-leave-to { opacity: 0; }
</style>
