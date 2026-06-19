-- =====================================================================
-- Ooru platform schema  (Cloudflare D1 / SQLite)
-- ---------------------------------------------------------------------
-- This file is the source of truth for the eventual backend API.
-- Until D1 is wired up, the frontend simulates these exact tables in
-- localStorage via src/lib/store.ts, so component code can be written
-- against the final shape today. When the API lands, the store swaps
-- for fetch() calls and nothing else changes.
--
-- Conventions:
--   * ids are uuid TEXT
--   * timestamps are epoch milliseconds (INTEGER)
--   * booleans are 0/1 INTEGER
--   * "polymorphic" tables (comments, reactions) attach to any subject
--     via (type, id) so one table serves campaigns, requests, makers...
-- =====================================================================

-- ── Profiles / users ────────────────────────────────────────────────
-- Start here: every interaction is performed *by* a profile.
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,                     -- uuid
  handle        TEXT NOT NULL UNIQUE,                 -- url-safe @handle
  name          TEXT NOT NULL,
  avatar_url    TEXT,                                 -- null -> render initials
  avatar_color  TEXT NOT NULL DEFAULT '#6B5B4A',
  bio           TEXT,
  location      TEXT,
  is_maker      INTEGER NOT NULL DEFAULT 0,           -- bool
  created_at    INTEGER NOT NULL
);

-- ── Follows (profile -> profile) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  follower_id   TEXT NOT NULL REFERENCES profiles(id),
  followee_id   TEXT NOT NULL REFERENCES profiles(id),
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);

-- ── Comments (polymorphic, threaded) ────────────────────────────────
-- subject_type: 'campaign' | 'request' | 'maker' | 'update'
CREATE TABLE IF NOT EXISTS comments (
  id            TEXT PRIMARY KEY,
  subject_type  TEXT NOT NULL,
  subject_id    TEXT NOT NULL,                        -- slug / id of subject
  author_id     TEXT NOT NULL REFERENCES profiles(id),
  parent_id     TEXT REFERENCES comments(id),         -- null = top-level reply
  body          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_comments_subject
  ON comments (subject_type, subject_id, created_at);

-- ── Reactions (hearts / upvotes on any target) ──────────────────────
-- target_type: 'comment' | 'campaign' | 'request' | 'update' | 'maker'
-- kind:        'heart' | 'upvote'
-- One row per (profile, target, kind) -> a toggle is INSERT/DELETE.
CREATE TABLE IF NOT EXISTS reactions (
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'heart',
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (profile_id, target_type, target_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_reactions_target
  ON reactions (target_type, target_id, kind);

-- ── Pledges (backing a campaign at a reward tier) ───────────────────
-- Backing model: reserve 25% now (deposit), pay the balance when the
-- project is ready to ship. Backers can cancel before shipment for a
-- full refund.
-- status: 'reserved' | 'paid' | 'shipped' | 'cancelled' | 'refunded'
CREATE TABLE IF NOT EXISTS pledges (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id),
  campaign_slug TEXT NOT NULL,
  tier_name     TEXT NOT NULL,
  amount_inr    INTEGER NOT NULL,                     -- full pledge
  deposit_inr   INTEGER NOT NULL,                     -- 25% taken now
  balance_inr   INTEGER NOT NULL,                     -- charged on ship
  status        TEXT NOT NULL DEFAULT 'reserved',
  created_at    INTEGER NOT NULL,
  cancelled_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON pledges (campaign_slug);
CREATE INDEX IF NOT EXISTS idx_pledges_profile  ON pledges (profile_id);

-- ── File downloads (interest signal on open-source files) ───────────
CREATE TABLE IF NOT EXISTS file_downloads (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT REFERENCES profiles(id),         -- null = anonymous
  campaign_slug TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_format   TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_file_downloads_campaign
  ON file_downloads (campaign_slug);
