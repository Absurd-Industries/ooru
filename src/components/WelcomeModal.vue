<script setup lang="ts">
/**
 * First-visit welcome modal — a paper note taped to the board. Welcomes the
 * visitor to the preview; the single button just gets out of the way.
 * Shows once, then never again (localStorage flag).
 */
import { ref, onMounted, onUnmounted } from "vue";

const STORAGE_KEY = "ooru-welcome-seen";
const visible = ref(false);

function dismiss() {
    visible.value = false;
    try {
        localStorage.setItem(STORAGE_KEY, "1");
    } catch {
        /* storage blocked — just close for this session */
    }
}

function onBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("coming-soon-backdrop"))
        dismiss();
}
function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && visible.value) dismiss();
}

onMounted(() => {
    let seen = false;
    try {
        seen = !!localStorage.getItem(STORAGE_KEY);
    } catch {
        seen = false;
    }
    if (!seen) setTimeout(() => (visible.value = true), 500);
    document.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
    document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
    <div
        :class="['coming-soon-backdrop', { active: visible }]"
        @click="onBackdropClick"
    >
        <div
            class="welcome-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
        >
            <span class="tape tape-l" aria-hidden="true"></span>
            <span class="tape tape-r" aria-hidden="true"></span>
            <div class="welcome-bg" aria-hidden="true"></div>
            <div class="welcome-content text-left">
                <i class="ph-bold ph-hand-waving text-5xl"></i>

                <p class="text-md mt-5 mb-4">
                    <strong>Welcome to the preview!</strong>
                    Wander through as a visitor, a maker, or a requester - we'd
                    love your thoughts :)
                </p>
                <button class="text-primary" @click="dismiss">
                    Explore the preview <i class="ph-bold ph-arrow-right"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.welcome-card {
    position: relative;
    width: 100%;
    max-width: 372px;
    padding: 2rem 1.85rem;
    text-align: center;
    transform: scale(0.95) translateY(10px) rotate(-0.6deg);
    transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1);
}
.coming-soon-backdrop.active .welcome-card {
    transform: scale(1) translateY(0) rotate(-0.6deg);
}

/* torn white-paper edge behind the content */
.welcome-bg {
    position: absolute;
    inset: 0;
    background: #faf3e8;
    /* torn silhouette + a shadow that follows it (chained, like the polaroids) */
    filter: url(#papercut) drop-shadow(0 12px 26px rgba(26, 26, 26, 0.22));
    z-index: 0;
}
.welcome-content {
    position: relative;
    z-index: 1;
}

/* masking tape stuck over the top corners */
.tape {
    position: absolute;
    top: -11px;
    z-index: 2;
    width: 92px;
    height: 28px;
    background: linear-gradient(
        180deg,
        rgba(245, 230, 200, 0.55),
        rgba(228, 211, 180, 0.72)
    );
    box-shadow: 0 1px 3px rgba(26, 26, 26, 0.12);
}
.tape-l {
    left: 14px;
    transform: rotate(-7deg);
}
.tape-r {
    right: 14px;
    transform: rotate(6deg);
}

.welcome-icon {
    width: 44px;
    height: 44px;
    border-radius: 0.7rem;
    background: rgba(217, 72, 0, 0.1);
    color: #d94800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    margin-bottom: 0.85rem;
}
.welcome-title {
    font-family: "Fraunces", Georgia, serif;
    font-weight: 900;
    font-size: 1.35rem;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
}
.welcome-desc {
    font-size: 0.85rem;
    color: #4a3d2f;
    line-height: 1.55;
    margin-bottom: 1.3rem;
}
.welcome-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.65rem 1.6rem;
    border-radius: 0.55rem;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 700;
    color: #faf3e8;
    background: #ff5900;
    transition:
        background 0.15s,
        transform 0.15s;
}
.welcome-cta:hover {
    background: #d94800;
    transform: translateY(-1px);
}
</style>
