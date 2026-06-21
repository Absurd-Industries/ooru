/**
 * Ooru local store - a browser-side simulation of the backend API.
 *
 * It mirrors db/schema.sql exactly (profiles, follows, comments,
 * reactions, pledges, file_downloads) and persists to localStorage, so
 * interactive components (hearts, comments, pledges) work end-to-end
 * today. When the real D1-backed API ships, swap these functions for
 * fetch() calls - the return shapes are already correct.
 *
 * SSR-safe: every access is guarded; on the server it returns sensible
 * empty/seed values and never touches localStorage.
 */

// ── Row types (match db/schema.sql) ─────────────────────────────────
export interface Profile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string;
  bio: string | null;
  location: string | null;
  is_maker: 0 | 1;
  created_at: number;
}

export type SubjectType = "campaign" | "request" | "maker" | "update";
export type TargetType = "comment" | "campaign" | "request" | "update" | "maker";
export type ReactionKind = "heart" | "upvote";

export interface Comment {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: number;
  edited_at: number | null;
  deleted_at: number | null;
}

export interface Reaction {
  profile_id: string;
  target_type: TargetType;
  target_id: string;
  kind: ReactionKind;
  created_at: number;
}

export type PledgeStatus =
  | "reserved"
  | "paid"
  | "shipped"
  | "cancelled"
  | "refunded";

export interface Pledge {
  id: string;
  profile_id: string;
  campaign_slug: string;
  tier_name: string;
  amount_inr: number;
  deposit_inr: number;
  balance_inr: number;
  status: PledgeStatus;
  created_at: number;
  cancelled_at: number | null;
}

export interface FileDownload {
  id: string;
  profile_id: string | null;
  campaign_slug: string;
  file_name: string;
  file_format: string | null;
  created_at: number;
}

interface DB {
  version: number;
  profiles: Profile[];
  follows: { follower_id: string; followee_id: string; created_at: number }[];
  comments: Comment[];
  reactions: Reaction[];
  pledges: Pledge[];
  file_downloads: FileDownload[];
  /** Local UI preferences: locale, cached geo, dismissed banners, etc. */
  prefs: Record<string, unknown>;
}

const KEY = "ooru.db.v1";
/**
 * Bump DB_VERSION on any release that changes this local schema, or whenever
 * you want to "burst" (wipe) every guest's local data. load() discards data
 * stamped with a different version, so a bump = a clean reset on next load.
 */
const DB_VERSION = 2;

// The signed-in "you" - the mock current profile. In production this
// comes from the session; here it's seeded once and reused.
const CURRENT_USER_ID = "you";

const SEED_USER: Profile = {
  id: CURRENT_USER_ID,
  handle: "you",
  name: "You",
  avatar_url: null,
  avatar_color: "#B74803",
  bio: "Curious builder. Backing open hardware on Ooru.",
  location: "Bengaluru, India",
  is_maker: 0,
  created_at: 0,
};

function emptyDB(): DB {
  return {
    version: DB_VERSION,
    profiles: [SEED_USER],
    follows: [],
    comments: [],
    reactions: [],
    pledges: [],
    file_downloads: [],
    prefs: {},
  };
}

const hasStorage = (): boolean => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

function load(): DB {
  if (!hasStorage()) return emptyDB();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyDB();
    const db = JSON.parse(raw) as DB;
    if (!db || db.version !== DB_VERSION) return emptyDB();
    // Make sure the current user + prefs always exist.
    if (!db.profiles.some((p) => p.id === CURRENT_USER_ID)) {
      db.profiles.push(SEED_USER);
    }
    if (!db.prefs) db.prefs = {};
    return db;
  } catch {
    return emptyDB();
  }
}

function save(db: DB): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
    // Let other islands on the page react to changes.
    window.dispatchEvent(new CustomEvent("ooru:db-change"));
  } catch {
    /* quota / private mode - ignore */
  }
}

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Profiles ────────────────────────────────────────────────────────
export function currentUser(): Profile {
  const db = load();
  return db.profiles.find((p) => p.id === CURRENT_USER_ID) ?? SEED_USER;
}

export function getProfile(id: string): Profile | null {
  return load().profiles.find((p) => p.id === id) ?? null;
}

export function upsertProfile(p: Profile): void {
  const db = load();
  const i = db.profiles.findIndex((x) => x.id === p.id);
  if (i >= 0) db.profiles[i] = p;
  else db.profiles.push(p);
  save(db);
}

// ── Preferences (locale, cached geo, dismissed banners, …) ──────────
export function getPref<T = unknown>(key: string, fallback: T): T {
  const v = load().prefs[key];
  return v === undefined ? fallback : (v as T);
}

export function setPref(key: string, value: unknown): void {
  const db = load();
  db.prefs[key] = value;
  save(db);
}

/**
 * Wipe the entire local guest session - a manual "burst". Everything the
 * guest accumulated (reactions, comments, pledges, follows, prefs) is local
 * only, so this fully resets their experience.
 */
export function resetGuest(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(KEY);
    // A full manual reset also clears the saved language choice.
    window.localStorage.removeItem("ooru.locale");
    window.dispatchEvent(new CustomEvent("ooru:db-change"));
  } catch {
    /* ignore */
  }
}

// ── Reactions (hearts / upvotes) ────────────────────────────────────
export function hasReacted(
  targetType: TargetType,
  targetId: string,
  kind: ReactionKind = "heart",
  profileId: string = CURRENT_USER_ID
): boolean {
  return load().reactions.some(
    (r) =>
      r.profile_id === profileId &&
      r.target_type === targetType &&
      r.target_id === targetId &&
      r.kind === kind
  );
}

/** Toggle a reaction. Returns true if it's now ON. */
export function toggleReaction(
  targetType: TargetType,
  targetId: string,
  kind: ReactionKind = "heart"
): boolean {
  const db = load();
  const idx = db.reactions.findIndex(
    (r) =>
      r.profile_id === CURRENT_USER_ID &&
      r.target_type === targetType &&
      r.target_id === targetId &&
      r.kind === kind
  );
  let on: boolean;
  if (idx >= 0) {
    db.reactions.splice(idx, 1);
    on = false;
  } else {
    db.reactions.push({
      profile_id: CURRENT_USER_ID,
      target_type: targetType,
      target_id: targetId,
      kind,
      created_at: Date.now(),
    });
    on = true;
  }
  save(db);
  return on;
}

/** Count of *stored* reactions (add your seed base separately in the UI). */
export function reactionCount(
  targetType: TargetType,
  targetId: string,
  kind: ReactionKind = "heart"
): number {
  return load().reactions.filter(
    (r) =>
      r.target_type === targetType &&
      r.target_id === targetId &&
      r.kind === kind
  ).length;
}

// ── Follows ─────────────────────────────────────────────────────────
export function isFollowing(
  followeeId: string,
  followerId: string = CURRENT_USER_ID
): boolean {
  return load().follows.some(
    (f) => f.follower_id === followerId && f.followee_id === followeeId
  );
}

/** Toggle following a profile. Returns true if now following. */
export function toggleFollow(followeeId: string): boolean {
  const db = load();
  const idx = db.follows.findIndex(
    (f) => f.follower_id === CURRENT_USER_ID && f.followee_id === followeeId
  );
  let on: boolean;
  if (idx >= 0) {
    db.follows.splice(idx, 1);
    on = false;
  } else {
    db.follows.push({
      follower_id: CURRENT_USER_ID,
      followee_id: followeeId,
      created_at: Date.now(),
    });
    on = true;
  }
  save(db);
  return on;
}

export function followerCount(followeeId: string): number {
  return load().follows.filter((f) => f.followee_id === followeeId).length;
}

// ── Comments ────────────────────────────────────────────────────────
export function getComments(
  subjectType: SubjectType,
  subjectId: string
): Comment[] {
  return load()
    .comments.filter(
      (c) =>
        c.subject_type === subjectType &&
        c.subject_id === subjectId &&
        !c.deleted_at
    )
    .sort((a, b) => a.created_at - b.created_at);
}

export function addComment(input: {
  subjectType: SubjectType;
  subjectId: string;
  parentId?: string | null;
  body: string;
}): Comment {
  const db = load();
  const comment: Comment = {
    id: uuid(),
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    author_id: CURRENT_USER_ID,
    parent_id: input.parentId ?? null,
    body: input.body.trim(),
    created_at: Date.now(),
    edited_at: null,
    deleted_at: null,
  };
  db.comments.push(comment);
  save(db);
  return comment;
}

export function deleteComment(id: string): void {
  const db = load();
  const c = db.comments.find((x) => x.id === id);
  if (c && c.author_id === CURRENT_USER_ID) {
    c.deleted_at = Date.now();
    save(db);
  }
}

// ── Pledges ─────────────────────────────────────────────────────────
export function getPledge(campaignSlug: string): Pledge | null {
  return (
    load().pledges.find(
      (p) =>
        p.campaign_slug === campaignSlug &&
        p.profile_id === CURRENT_USER_ID &&
        p.status !== "cancelled"
    ) ?? null
  );
}

export function createPledge(input: {
  campaignSlug: string;
  tierName: string;
  amountInr: number;
}): Pledge {
  const db = load();
  // One active pledge per campaign - replace any existing.
  db.pledges = db.pledges.filter(
    (p) =>
      !(p.campaign_slug === input.campaignSlug && p.profile_id === CURRENT_USER_ID)
  );
  const deposit = Math.round(input.amountInr * 0.25);
  const pledge: Pledge = {
    id: uuid(),
    profile_id: CURRENT_USER_ID,
    campaign_slug: input.campaignSlug,
    tier_name: input.tierName,
    amount_inr: input.amountInr,
    deposit_inr: deposit,
    balance_inr: input.amountInr - deposit,
    status: "reserved",
    created_at: Date.now(),
    cancelled_at: null,
  };
  db.pledges.push(pledge);
  save(db);
  return pledge;
}

export function cancelPledge(id: string): void {
  const db = load();
  const p = db.pledges.find((x) => x.id === id);
  if (p && p.profile_id === CURRENT_USER_ID) {
    p.status = "cancelled";
    p.cancelled_at = Date.now();
    save(db);
  }
}

// ── File downloads (interest signal) ────────────────────────────────
export function logDownload(input: {
  campaignSlug: string;
  fileName: string;
  fileFormat?: string;
}): void {
  const db = load();
  db.file_downloads.push({
    id: uuid(),
    profile_id: currentUser().id,
    campaign_slug: input.campaignSlug,
    file_name: input.fileName,
    file_format: input.fileFormat ?? null,
    created_at: Date.now(),
  });
  save(db);
}

// ── Misc ────────────────────────────────────────────────────────────
/** Subscribe to any change in the store (fires across islands). */
export function onChange(fn: () => void): () => void {
  if (!hasStorage()) return () => {};
  const handler = () => fn();
  window.addEventListener("ooru:db-change", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("ooru:db-change", handler);
    window.removeEventListener("storage", handler);
  };
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
