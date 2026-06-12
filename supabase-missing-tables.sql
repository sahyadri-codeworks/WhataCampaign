-- Run this in Supabase SQL Editor to create ONLY the missing tables
-- (contacts, campaigns, messages already exist)

CREATE TABLE IF NOT EXISTS connectors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL DEFAULT 'anon-fallback',
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'inactive',
  is_fallback          BOOLEAN NOT NULL DEFAULT false,
  config_encrypted     JSONB NOT NULL DEFAULT '{}',
  last_successful_send TIMESTAMPTZ,
  error_rate_24h       NUMERIC(5,2) NOT NULL DEFAULT 0,
  messaging_tier       TEXT,
  quality_rating       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journeys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL DEFAULT 'anon-fallback',
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft',
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL DEFAULT 'anon-fallback',
  name          TEXT NOT NULL,
  filter_query  TEXT NOT NULL DEFAULT '',
  contact_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL DEFAULT 'anon-fallback',
  campaign_id    UUID,
  contact_id     UUID,
  contact_phone  TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'queued',
  error_code     TEXT,
  connector_used TEXT,
  sent_at        TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ,
  read_at        TIMESTAMPTZ,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_custom_fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  field_key  TEXT NOT NULL,
  field_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optin_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL,
  from_state TEXT NOT NULL,
  to_state   TEXT NOT NULL,
  source     TEXT NOT NULL,
  channel    TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  user_id     TEXT NOT NULL DEFAULT 'anon-fallback',
  phone       TEXT NOT NULL,
  name        TEXT,
  extra_data  JSONB DEFAULT '{}',
  batch_day   INT NOT NULL DEFAULT 1,
  send_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Also fix existing tables: change user_id from UUID to TEXT if needed
ALTER TABLE contacts ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE contacts ALTER COLUMN user_id SET DEFAULT 'anon-fallback';
ALTER TABLE campaigns ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE campaigns ALTER COLUMN user_id SET DEFAULT 'anon-fallback';
