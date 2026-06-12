-- WhataCampaign — Full Supabase Schema (Clean Install)
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- WARNING: This drops ALL existing WhataCampaign tables and recreates them.

-- ============================================================
-- 0. DROP OLD TABLES (order matters for FK constraints)
-- ============================================================
DROP VIEW IF EXISTS error_code_summary CASCADE;
DROP VIEW IF EXISTS daily_send_volume CASCADE;
DROP VIEW IF EXISTS campaign_stats CASCADE;

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS campaign_contacts CASCADE;
DROP TABLE IF EXISTS optin_audit_log CASCADE;
DROP TABLE IF EXISTS message_log CASCADE;
DROP TABLE IF EXISTS contact_custom_fields CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS journeys CASCADE;
DROP TABLE IF EXISTS connectors CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- ============================================================
-- 1. CONTACTS
-- ============================================================
CREATE TABLE contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  phone           TEXT NOT NULL,
  name            TEXT,
  optin_category  TEXT NOT NULL DEFAULT 'none'
    CHECK (optin_category IN ('none','utility_only','marketing','double_confirmed','opted_out')),
  optin_source    TEXT,
  optin_timestamp TIMESTAMPTZ,
  tier_tag        TEXT NOT NULL DEFAULT 'New'
    CHECK (tier_tag IN ('VIP','Regular','New')),
  last_message_at TIMESTAMPTZ,
  block_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);

CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_optin ON contacts(optin_category);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_tier ON contacts(tier_tag);

-- ============================================================
-- 2. CONTACT CUSTOM FIELDS
-- ============================================================
CREATE TABLE contact_custom_fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_key  TEXT NOT NULL,
  field_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, field_key)
);

CREATE INDEX idx_custom_fields_contact ON contact_custom_fields(contact_id);

-- ============================================================
-- 3. CAMPAIGNS
-- ============================================================
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'Marketing'
    CHECK (category IN ('Marketing','Utility','Authentication')),
  template_id     TEXT,
  template_name   TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','completed','paused')),
  start_date      DATE,
  end_date        DATE,
  daily_limit     INT NOT NULL DEFAULT 100,
  cooldown_days   INT NOT NULL DEFAULT 7,
  scheduled_at    TIMESTAMPTZ,
  total_sent      INT NOT NULL DEFAULT 0,
  total_delivered INT NOT NULL DEFAULT 0,
  total_read      INT NOT NULL DEFAULT 0,
  total_responded INT NOT NULL DEFAULT 0,
  total_failed    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- ============================================================
-- 4. MESSAGE LOG
-- ============================================================
CREATE TABLE message_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id     UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_phone  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','read','failed','responded')),
  error_code     TEXT,
  connector_used TEXT,
  sent_at        TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ,
  read_at        TIMESTAMPTZ,
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msglog_campaign ON message_log(campaign_id);
CREATE INDEX idx_msglog_contact ON message_log(contact_id);
CREATE INDEX idx_msglog_status ON message_log(status);
CREATE INDEX idx_msglog_error ON message_log(error_code) WHERE error_code IS NOT NULL;
CREATE INDEX idx_msglog_sent ON message_log(sent_at);

-- ============================================================
-- 5. JOURNEYS
-- ============================================================
CREATE TABLE journeys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','completed')),
  graph_data JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journeys_user ON journeys(user_id);

-- ============================================================
-- 6. SEGMENTS
-- ============================================================
CREATE TABLE segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  name          TEXT NOT NULL,
  filter_query  TEXT NOT NULL,
  contact_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_segments_user ON segments(user_id);

-- ============================================================
-- 7. OPT-IN AUDIT LOG
-- ============================================================
CREATE TABLE optin_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state   TEXT NOT NULL,
  source     TEXT NOT NULL,
  channel    TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_optin_audit_contact ON optin_audit_log(contact_id);
CREATE INDEX idx_optin_audit_time ON optin_audit_log(created_at);

-- ============================================================
-- 8. CONNECTORS
-- ============================================================
CREATE TABLE connectors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL
    CHECK (type IN ('meta_cloud_api','360dialog','wati','interakt','crm_webhook')),
  status               TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active','inactive','error')),
  is_fallback          BOOLEAN NOT NULL DEFAULT false,
  config_encrypted     JSONB NOT NULL DEFAULT '{}',
  last_successful_send TIMESTAMPTZ,
  error_rate_24h       NUMERIC(5,2) NOT NULL DEFAULT 0,
  messaging_tier       TEXT,
  quality_rating       TEXT CHECK (quality_rating IS NULL OR quality_rating IN ('GREEN','YELLOW','RED')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectors_user ON connectors(user_id);

-- ============================================================
-- 9. CAMPAIGN CONTACTS (batch assignment)
-- ============================================================
CREATE TABLE campaign_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  phone       TEXT NOT NULL,
  name        TEXT,
  extra_data  JSONB DEFAULT '{}',
  batch_day   INT NOT NULL,
  send_date   DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_campaign ON campaign_contacts(campaign_id);

-- ============================================================
-- 10. MESSAGES (template content per campaign)
-- ============================================================
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  ai_score      INT,
  ai_flags      JSONB DEFAULT '[]',
  ai_suggestion TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_campaign ON messages(campaign_id);

-- ============================================================
-- 11. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE optin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users manage own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own custom fields" ON contact_custom_fields
  FOR ALL USING (contact_id IN (SELECT id FROM contacts WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own campaigns" ON campaigns
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own message logs" ON message_log
  FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own journeys" ON journeys
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own segments" ON segments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own audit log" ON optin_audit_log
  FOR ALL USING (contact_id IN (SELECT id FROM contacts WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own connectors" ON connectors
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own campaign contacts" ON campaign_contacts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own messages" ON messages
  FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

-- ============================================================
-- 12. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_journeys_updated
  BEFORE UPDATE ON journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_segments_updated
  BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_connectors_updated
  BEFORE UPDATE ON connectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 13. ANALYTICS VIEWS
-- ============================================================
CREATE OR REPLACE VIEW campaign_stats AS
SELECT
  c.id,
  c.name,
  c.category,
  c.status,
  c.created_at,
  COUNT(ml.id) AS total_messages,
  COUNT(ml.id) FILTER (WHERE ml.status = 'delivered') AS delivered,
  COUNT(ml.id) FILTER (WHERE ml.status = 'read') AS read_count,
  COUNT(ml.id) FILTER (WHERE ml.status = 'responded') AS responded,
  COUNT(ml.id) FILTER (WHERE ml.status = 'failed') AS failed,
  ROUND(
    COUNT(ml.id) FILTER (WHERE ml.status = 'delivered') * 100.0 / NULLIF(COUNT(ml.id), 0),
    1
  ) AS delivery_pct,
  ROUND(
    COUNT(ml.id) FILTER (WHERE ml.status = 'failed') * 100.0 / NULLIF(COUNT(ml.id), 0),
    1
  ) AS block_rate
FROM campaigns c
LEFT JOIN message_log ml ON ml.campaign_id = c.id
GROUP BY c.id;

CREATE OR REPLACE VIEW daily_send_volume AS
SELECT
  DATE(sent_at) AS send_date,
  COUNT(*) AS total_sent,
  COUNT(*) FILTER (WHERE status = 'delivered') AS total_delivered,
  COUNT(*) FILTER (WHERE status = 'failed') AS total_failed
FROM message_log
WHERE sent_at IS NOT NULL
GROUP BY DATE(sent_at)
ORDER BY send_date DESC;

CREATE OR REPLACE VIEW error_code_summary AS
SELECT
  error_code,
  COUNT(*) AS occurrence_count,
  MAX(created_at) AS last_occurred
FROM message_log
WHERE error_code IS NOT NULL
GROUP BY error_code
ORDER BY occurrence_count DESC;
