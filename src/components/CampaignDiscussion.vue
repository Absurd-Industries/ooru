<script setup lang="ts">
/**
 * Campaign discussion - real, working comments + hearts backed by the
 * local store (src/lib/store.ts). Seeded with the campaign's existing
 * comments; anything you post or heart persists in localStorage as the
 * current mock profile, and is shaped to drop into the future API.
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import { t } from "../lib/i18n-client";
import {
  currentUser,
  getComments,
  addComment,
  toggleReaction,
  hasReacted,
  reactionCount,
  relativeTime,
  initials,
  onChange,
} from "../lib/store";

interface SeedPerson {
  id: number | string;
  author: string;
  initials: string;
  color: string;
  badge?: string | null;
  badgeVariant?: string;
  time: string;
  content: string;
  hearts?: number;
}
interface SeedComment extends SeedPerson {
  replies?: SeedPerson[];
}

const props = withDefaults(
  defineProps<{
    subjectId: string;
    subjectType?: "campaign" | "maker" | "request" | "update";
    title?: string;
    seed?: SeedComment[];
    makerName?: string;
  }>(),
  { subjectType: "campaign", title: "Discussion" }
);

// Translate the known section titles; pass through anything custom.
const titleLabel = computed(() => {
  if (props.title === "Wall") return t("discussion.wall");
  if (props.title === "Discussion") return t("discussion.title");
  return props.title;
});

const seedKey = (id: number | string) =>
  `seed:${props.subjectType}:${props.subjectId}:${id}`;

const me = currentUser();
const tick = ref(0);
let unsub: () => void = () => {};
onMounted(() => {
  unsub = onChange(() => tick.value++);
});
onUnmounted(() => unsub());

const userComments = computed(() => {
  tick.value; // reactive dependency
  return getComments(props.subjectType, props.subjectId);
});
const topLevel = computed(() => userComments.value.filter((c) => !c.parent_id));
const repliesOf = (id: string) =>
  userComments.value.filter((c) => c.parent_id === id);

const seedCount = computed(
  () =>
    (props.seed || []).reduce(
      (n, c) => n + 1 + (c.replies ? c.replies.length : 0),
      0
    )
);
const totalCount = computed(() => seedCount.value + userComments.value.length);

// ── Composer ──────────────────────────────────────────────────────
const newComment = ref("");
function post() {
  const body = newComment.value.trim();
  if (!body) return;
  addComment({ subjectType: props.subjectType, subjectId: props.subjectId, body });
  newComment.value = "";
}

const replyingTo = ref<string | null>(null);
const replyText = ref("");
function openReply(id: string) {
  replyingTo.value = replyingTo.value === id ? null : id;
  replyText.value = "";
}
function postReply(parentId: string) {
  const body = replyText.value.trim();
  if (!body) return;
  addComment({
    subjectType: props.subjectType,
    subjectId: props.subjectId,
    parentId,
    body,
  });
  replyText.value = "";
  replyingTo.value = null;
}

// ── Hearts ────────────────────────────────────────────────────────
function heartCount(key: string, base = 0) {
  tick.value;
  return base + reactionCount("comment", key);
}
function hearted(key: string) {
  tick.value;
  return hasReacted("comment", key);
}
function toggleHeart(key: string) {
  toggleReaction("comment", key);
}
</script>

<template>
  <div>
    <h2 class="font-serif font-bold text-lg mb-2">
      {{ titleLabel }}
      <span class="text-sm font-sans font-normal text-ink-faint ml-1">({{ totalCount }})</span>
    </h2>

    <!-- Composer -->
    <div class="mb-6 mt-4">
      <div class="flex gap-3">
        <div class="dsc-avatar" :style="{ background: me.avatar_color }">
          {{ initials(me.name) }}
        </div>
        <div class="flex-1">
          <textarea
            v-model="newComment"
            class="comment-textarea"
            :placeholder='t("discussion.placeholder")'
            rows="2"
            @keydown.meta.enter="post"
            @keydown.ctrl.enter="post"
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <a href="https://discord.gg/DUSUtguG2H" target="_blank" rel="noopener" class="text-xs text-stencil hover:text-stamp" style="text-decoration:none;">{{ t("discussion.orDiscord") }}</a>
            <button class="btn btn-stamp btn-sm" :disabled="!newComment.trim()" :style="!newComment.trim() ? 'opacity:0.4;cursor:not-allowed;' : ''" @click="post">{{ t("discussion.post") }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Your new top-level comments (newest first, above the seed) -->
    <div v-if="topLevel.length" class="mb-1">
      <div v-for="c in [...topLevel].reverse()" :key="c.id" class="dsc-entry">
        <div class="flex gap-3">
          <div class="dsc-avatar" :style="{ background: me.avatar_color }">{{ initials(me.name) }}</div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-sm font-semibold">{{ me.name }}</span>
              <span class="dsc-badge">{{ t("discussion.you") }}</span>
              <span class="text-xs text-ink-faint">{{ relativeTime(c.created_at) }}</span>
            </div>
            <p class="text-sm leading-relaxed text-ink-light whitespace-pre-line">{{ c.body }}</p>
            <div class="flex items-center gap-3 mt-2">
              <button class="dsc-act" :class="{ on: hearted(c.id) }" @click="toggleHeart(c.id)">
                <i :class="hearted(c.id) ? 'ph-fill ph-heart' : 'ph-bold ph-heart'"></i>
                <span v-if="heartCount(c.id)">{{ heartCount(c.id) }}</span>
              </button>
              <button class="dsc-act" @click="openReply(c.id)"><i class="ph-bold ph-chat-circle"></i> Reply</button>
            </div>

            <!-- replies -->
            <div v-if="repliesOf(c.id).length || replyingTo === c.id" class="mt-3 space-y-3">
              <div v-for="r in repliesOf(c.id)" :key="r.id" class="dsc-reply">
                <div class="flex gap-3">
                  <div class="dsc-avatar dsc-avatar--sm" :style="{ background: me.avatar_color }">{{ initials(me.name) }}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <span class="text-sm font-semibold">{{ me.name }}</span>
                      <span class="dsc-badge">{{ t("discussion.you") }}</span>
                      <span class="text-xs text-ink-faint">{{ relativeTime(r.created_at) }}</span>
                    </div>
                    <p class="text-sm leading-relaxed text-ink-light whitespace-pre-line">{{ r.body }}</p>
                    <button class="dsc-act mt-1.5" :class="{ on: hearted(r.id) }" @click="toggleHeart(r.id)">
                      <i :class="hearted(r.id) ? 'ph-fill ph-heart' : 'ph-bold ph-heart'"></i>
                      <span v-if="heartCount(r.id)">{{ heartCount(r.id) }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="replyingTo === c.id" class="dsc-reply-box">
                <textarea v-model="replyText" class="comment-textarea" :placeholder='t("discussion.replyPlaceholder")' rows="2"></textarea>
                <div class="flex justify-end gap-2 mt-2">
                  <button class="btn btn-outline btn-sm" @click="replyingTo = null">{{ t("discussion.cancel") }}</button>
                  <button class="btn btn-stamp btn-sm" :disabled="!replyText.trim()" :style="!replyText.trim() ? 'opacity:0.4;cursor:not-allowed;' : ''" @click="postReply(c.id)">{{ t("discussion.reply") }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Seed comments -->
    <div>
      <div v-for="comment in seed || []" :key="'seed-' + comment.id" class="dsc-entry">
        <div class="flex gap-3">
          <div class="dsc-avatar" :style="{ background: comment.color }">{{ comment.initials }}</div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1">
              <span class="text-sm font-semibold">{{ comment.author }}</span>
              <span v-if="comment.badge" class="dsc-badge" :class="'dsc-badge--' + (comment.badgeVariant || 'default')">{{ comment.badge }}</span>
              <span class="text-xs text-ink-faint">{{ comment.time }}</span>
            </div>
            <p class="text-sm leading-relaxed text-ink-light">{{ comment.content }}</p>
            <div class="flex items-center gap-3 mt-2">
              <button class="dsc-act" :class="{ on: hearted(seedKey(comment.id)) }" @click="toggleHeart(seedKey(comment.id))">
                <i :class="hearted(seedKey(comment.id)) ? 'ph-fill ph-heart' : 'ph-bold ph-heart'"></i>
                <span>{{ heartCount(seedKey(comment.id), comment.hearts || 0) }}</span>
              </button>
              <button class="dsc-act" @click="openReply(seedKey(comment.id))"><i class="ph-bold ph-chat-circle"></i> Reply</button>
            </div>

            <div v-if="(comment.replies && comment.replies.length) || repliesOf(seedKey(comment.id)).length || replyingTo === seedKey(comment.id)" class="mt-3 space-y-3">
              <div v-for="reply in comment.replies || []" :key="'sr-' + reply.id" class="dsc-reply">
                <div class="flex gap-3">
                  <div class="dsc-avatar dsc-avatar--sm" :style="{ background: reply.color }">{{ reply.initials }}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <span class="text-sm font-semibold">{{ reply.author }}</span>
                      <span v-if="reply.badge" class="dsc-badge" :class="'dsc-badge--' + (reply.badgeVariant || 'default')">{{ reply.badge }}</span>
                      <span class="text-xs text-ink-faint">{{ reply.time }}</span>
                    </div>
                    <p class="text-sm leading-relaxed text-ink-light">{{ reply.content }}</p>
                    <button class="dsc-act mt-1.5" :class="{ on: hearted(seedKey(reply.id)) }" @click="toggleHeart(seedKey(reply.id))">
                      <i :class="hearted(seedKey(reply.id)) ? 'ph-fill ph-heart' : 'ph-bold ph-heart'"></i>
                      <span>{{ heartCount(seedKey(reply.id), reply.hearts || 0) }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- your replies to a seed comment -->
              <div v-for="r in repliesOf(seedKey(comment.id))" :key="r.id" class="dsc-reply">
                <div class="flex gap-3">
                  <div class="dsc-avatar dsc-avatar--sm" :style="{ background: me.avatar_color }">{{ initials(me.name) }}</div>
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <span class="text-sm font-semibold">{{ me.name }}</span>
                      <span class="dsc-badge">{{ t("discussion.you") }}</span>
                      <span class="text-xs text-ink-faint">{{ relativeTime(r.created_at) }}</span>
                    </div>
                    <p class="text-sm leading-relaxed text-ink-light whitespace-pre-line">{{ r.body }}</p>
                  </div>
                </div>
              </div>

              <div v-if="replyingTo === seedKey(comment.id)" class="dsc-reply-box">
                <textarea v-model="replyText" class="comment-textarea" :placeholder='t("discussion.replyPlaceholder")' rows="2"></textarea>
                <div class="flex justify-end gap-2 mt-2">
                  <button class="btn btn-outline btn-sm" @click="replyingTo = null">{{ t("discussion.cancel") }}</button>
                  <button class="btn btn-stamp btn-sm" :disabled="!replyText.trim()" :style="!replyText.trim() ? 'opacity:0.4;cursor:not-allowed;' : ''" @click="postReply(seedKey(comment.id))">{{ t("discussion.reply") }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dsc-avatar {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: #faf3e8;
  clip-path: url(#rounded-octagon);
}
.dsc-avatar--sm {
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.62rem;
}
.dsc-entry {
  padding: 1rem 0;
  border-top: 1px solid rgba(26, 26, 26, 0.06);
}
.dsc-entry:first-child { border-top: none; }
.dsc-reply {
  padding: 0.85rem 0 0;
}
.comment-textarea {
  width: 100%;
  border: 1.5px solid rgba(26, 26, 26, 0.12);
  border-radius: 0.625rem;
  background: rgba(250, 243, 232, 0.5);
  padding: 0.65rem 0.85rem;
  font-size: 0.85rem;
  font-family: inherit;
  color: #1a1a1a;
  resize: vertical;
  transition: border-color 0.15s;
}
.comment-textarea:focus {
  outline: none;
  border-color: #ff5900;
}
.dsc-act {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b5b4a;
  transition: color 0.15s;
  padding: 0;
}
.dsc-act:hover { color: #ff5900; }
.dsc-act.on { color: #ff5900; }
/* Fixed-width icon box stops the bold<->fill glyph swap from nudging
   the count, and gives the heart a smooth springy pop on toggle. */
.dsc-act i {
  display: inline-flex;
  justify-content: center;
  width: 1.05em;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}
.dsc-act.on i { transform: scale(1.18); }
.dsc-act:active i { transform: scale(0.82); }
.dsc-act span { font-variant-numeric: tabular-nums; }
.dsc-badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(26, 26, 26, 0.08);
  color: #4a3d2f;
}
.dsc-badge--stamp { background: rgba(255, 89, 0, 0.12); color: #b74803; }
.dsc-badge--funded { background: rgba(42, 95, 65, 0.12); color: #2a5f41; }
.dsc-reply-box { padding-left: 0; }
</style>
