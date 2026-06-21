<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = withDefaults(
    defineProps<{
        images: string[];
        alt: string;
        /** "hero" = full-bleed cover with overlaid thumbnails (folio); "default" = rounded card (campaign). */
        variant?: "default" | "hero";
    }>(),
    { variant: "default" },
);

const activeIndex = ref(0);
const dialogRef = ref<HTMLDialogElement | null>(null);

function selectImage(index: number) {
    activeIndex.value = index;
}
function prev() {
    activeIndex.value =
        (activeIndex.value - 1 + props.images.length) % props.images.length;
}
function next() {
    activeIndex.value = (activeIndex.value + 1) % props.images.length;
}

function openLightbox() {
    dialogRef.value?.showModal();
}
function closeLightbox() {
    dialogRef.value?.close();
}

function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") prev();
    else if (e.key === "ArrowRight") next();
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
    <div class="gallery-viewer" :class="`gallery-viewer--${props.variant}`">
        <!-- Primary image -->
        <div class="gallery-primary">
            <img
                :src="props.images[activeIndex]"
                :alt="props.alt"
                class="gallery-primary-img"
                @click="openLightbox"
            />

            <!-- Prev / next arrows -->
            <template v-if="props.images.length > 1">
                <button
                    class="gallery-arrow gallery-arrow--prev"
                    @click.stop="prev"
                    aria-label="Previous image"
                >
                    <i class="ph-bold ph-caret-left"></i>
                </button>
                <button
                    class="gallery-arrow gallery-arrow--next"
                    @click.stop="next"
                    aria-label="Next image"
                >
                    <i class="ph-bold ph-caret-right"></i>
                </button>
                <div class="gallery-counter">
                    {{ activeIndex + 1 }} / {{ props.images.length }}
                </div>
            </template>
        </div>

        <!-- Thumbnail row -->
        <div class="gallery-thumbs">
            <button
                v-for="(img, idx) in props.images"
                :key="idx"
                class="gallery-thumb"
                :class="{ 'gallery-thumb--active': idx === activeIndex }"
                @click="selectImage(idx)"
            >
                <img :src="img" :alt="`${props.alt} thumbnail ${idx + 1}`" />
            </button>
        </div>

        <!-- Lightbox dialog -->
        <dialog ref="dialogRef" class="gallery-lightbox" @click="closeLightbox">
            <div class="gallery-lightbox-content" @click.stop>
                <button class="gallery-lightbox-close" @click="closeLightbox">
                    &times;
                </button>
                <button
                    v-if="props.images.length > 1"
                    class="gallery-arrow gallery-arrow--prev gallery-arrow--lb"
                    @click.stop="prev"
                    aria-label="Previous image"
                >
                    <i class="ph-bold ph-caret-left"></i>
                </button>
                <img
                    :src="props.images[activeIndex]"
                    :alt="props.alt"
                    class="gallery-lightbox-img"
                />
                <button
                    v-if="props.images.length > 1"
                    class="gallery-arrow gallery-arrow--next gallery-arrow--lb"
                    @click.stop="next"
                    aria-label="Next image"
                >
                    <i class="ph-bold ph-caret-right"></i>
                </button>
            </div>
        </dialog>
    </div>
</template>

<style scoped>
.gallery-viewer {
    overflow: hidden;
}
.gallery-viewer--default {
    border-radius: 0.875rem;
}

.gallery-primary {
    position: relative;
    width: 100%;
    height: 16rem;
    cursor: pointer;
    overflow: hidden;
    background: #ece0cc;
}
@media (min-width: 640px) {
    .gallery-primary {
        height: 20rem;
    }
}
.gallery-viewer--hero .gallery-primary {
    height: 17rem;
}
@media (min-width: 640px) {
    .gallery-viewer--hero .gallery-primary {
        height: 22rem;
    }
}
@media (min-width: 1024px) {
    .gallery-viewer--hero .gallery-primary {
        height: 36rem;
    }
}

.gallery-primary-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.2s ease;
}
.gallery-primary:hover .gallery-primary-img {
    transform: scale(1.02);
}

/* Prev / next arrows */
.gallery-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 5;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(26, 26, 26, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: #faf3e8;
    border: 1.5px solid rgba(250, 243, 232, 0.15);
    cursor: pointer;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
        background 0.15s,
        border-color 0.15s;
}
.gallery-arrow:hover {
    background: rgba(26, 26, 26, 0.8);
    border-color: rgba(250, 243, 232, 0.3);
}
.gallery-arrow--prev {
    left: 12px;
}
.gallery-arrow--next {
    right: 12px;
}
.gallery-counter {
    position: absolute;
    bottom: 12px;
    right: 12px;
    z-index: 5;
    font-size: 0.7rem;
    font-weight: 600;
    color: #faf3e8;
    background: rgba(26, 26, 26, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 999px;
    padding: 0.2rem 0.6rem;
    pointer-events: none;
}

.gallery-thumbs {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #faf3e8;
    overflow-x: auto;
    scrollbar-width: none;
}
.gallery-thumbs::-webkit-scrollbar {
    display: none;
}

.gallery-thumb {
    width: 4rem;
    height: 4rem;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    background: none;
    flex-shrink: 0;
    transition: border-color 0.15s ease;
}
.gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.gallery-thumb--active {
    border-color: #ff5900;
}
.gallery-thumb:hover:not(.gallery-thumb--active) {
    border-color: rgba(255, 89, 0, 0.4);
}

/* Lightbox */
.gallery-lightbox {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    border: none;
    padding: 0;
    margin: 0;
    background: rgba(26, 26, 26, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
}
.gallery-lightbox::backdrop {
    background: transparent;
}
.gallery-lightbox:not([open]) {
    display: none;
}
.gallery-lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
}
.gallery-lightbox-close {
    position: absolute;
    top: -2.5rem;
    right: 0;
    background: none;
    border: none;
    color: #faf3e8;
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem 0.5rem;
    z-index: 6;
}
.gallery-lightbox-close:hover {
    color: #ff5900;
}
.gallery-arrow--lb {
    position: absolute;
}
.gallery-arrow--lb.gallery-arrow--prev {
    left: -3.5rem;
}
.gallery-arrow--lb.gallery-arrow--next {
    right: -3.5rem;
}
@media (max-width: 640px) {
    .gallery-arrow--lb.gallery-arrow--prev {
        left: 0.5rem;
    }
    .gallery-arrow--lb.gallery-arrow--next {
        right: 0.5rem;
    }
}
.gallery-lightbox-img {
    max-width: 90vw;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 0.5rem;
}
</style>
