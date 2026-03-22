-- ============================================================
-- RecapReels — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (admin / creator accounts) ────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'creator')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Clients ─────────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  unique_link_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  tnc_accepted   BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Events ──────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  occasion_type  TEXT DEFAULT '',
  date           DATE NOT NULL,
  status         TEXT DEFAULT 'UPCOMING',
  total_amount   NUMERIC(12, 2) DEFAULT 0,
  start_time     TEXT,
  end_time       TEXT,
  duration       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Event Details (editable by client) ──────────────────────────────────────
CREATE TABLE event_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  description      TEXT DEFAULT '',
  music_preferences TEXT DEFAULT '',
  location_link    TEXT DEFAULT '',
  client_poc_name  TEXT DEFAULT '',
  client_poc_phone TEXT DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Event POC (internal team point-of-contact) ───────────────────────────────
CREATE TABLE event_poc (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT DEFAULT '',
  phone      TEXT DEFAULT ''
);

-- ─── Event OTPs ──────────────────────────────────────────────────────────────
CREATE TABLE event_otps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_otp  TEXT DEFAULT '',
  end_otp    TEXT DEFAULT ''
);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  amount     NUMERIC(12, 2) NOT NULL,
  method     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'PENDING', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Files ────────────────────────────────────────────────────────────────────
CREATE TABLE files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  file_type    TEXT NOT NULL CHECK (file_type IN ('reel', 'picture', 'raw')),
  url          TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size         BIGINT DEFAULT 0,
  thumbnail    TEXT DEFAULT '',
  uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Ratings ─────────────────────────────────────────────────────────────────
CREATE TABLE ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  value      INTEGER NOT NULL CHECK (value BETWEEN 0 AND 5),
  comment    TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Creator Assignments ──────────────────────────────────────────────────────
CREATE TABLE creator_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (creator_id, event_id)
);

-- ─── Analytics Events ─────────────────────────────────────────────────────────
CREATE TABLE analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE SET NULL,
  client_id  UUID REFERENCES clients(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_events_client_id ON events(client_id);
CREATE INDEX idx_payments_event_id ON payments(event_id);
CREATE INDEX idx_files_event_id ON files(event_id);
CREATE INDEX idx_files_type ON files(file_type);
CREATE INDEX idx_creator_assignments_creator ON creator_assignments(creator_id);
CREATE INDEX idx_analytics_client ON analytics_events(client_id);
CREATE INDEX idx_analytics_event ON analytics_events(event_id);

-- ─── Supabase Storage ─────────────────────────────────────────────────────────
-- Run in Supabase Storage UI or via dashboard:
-- 1. Create bucket: recapreels
-- 2. Set to PUBLIC (so URLs work without auth tokens)
-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('recapreels', 'recapreels', true)
ON CONFLICT (id) DO NOTHING;
