-- Campaign Sort: Intelligent Data Distribution & Scheduling Engine
-- Migration: adds campaign planning, job queue, sequences, and contact scoring

-- ============================================================
-- 1. Extend campaigns table
-- ============================================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS connector_id uuid REFERENCES public.connectors(id),
  ADD COLUMN IF NOT EXISTS fallback_connector_id uuid REFERENCES public.connectors(id),
  ADD COLUMN IF NOT EXISTS template_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variable_mappings jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_segment_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience_tag_filter text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience_custom_filter jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exclude_tags text[] DEFAULT ARRAY['Opted_Out', 'Do_Not_Disturb']::text[],
  ADD COLUMN IF NOT EXISTS cooldown_hours int DEFAULT 48,
  ADD COLUMN IF NOT EXISTS max_messages_per_contact int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS send_window_start time DEFAULT '10:00',
  ADD COLUMN IF NOT EXISTS send_window_end time DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS priority_mode text DEFAULT 'engagement'
    CHECK (priority_mode IN ('engagement', 'recency', 'tag_priority', 'round_robin')),
  ADD COLUMN IF NOT EXISTS priority_weights jsonb DEFAULT '{"engagement":40,"recency":20,"tag":20,"optin":20}'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_json jsonb,
  ADD COLUMN IF NOT EXISTS plan_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Widen the status check to include new campaign lifecycle states
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft','planned','scheduled','sending','active','paused','completed','cancelled'));

-- ============================================================
-- 2. Extend contacts table
-- ============================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS engagement_score float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_campaign_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS freq_capped_until timestamptz,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- ============================================================
-- 3. Campaign sequence steps (multi-message drip)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_order int NOT NULL DEFAULT 1,
  template_id text,
  template_name text,
  day_offset int NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'always'
    CHECK (condition IN ('always','not_replied','not_clicked','not_converted')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_campaign
  ON public.campaign_sequence_steps(campaign_id, step_order);

-- ============================================================
-- 4. Campaign jobs (DB-based job queue)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  contact_phone text NOT NULL,
  sequence_step int NOT NULL DEFAULT 1,
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','delivered','failed','skipped','cancelled')),
  connector_used text,
  skip_reason text,
  error_code text,
  message_log_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_pending
  ON public.campaign_jobs(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jobs_campaign
  ON public.campaign_jobs(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_contact
  ON public.campaign_jobs(contact_id, campaign_id);

-- ============================================================
-- 5. Campaign daily batches (aggregated stats per day)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.campaign_daily_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  batch_date date NOT NULL,
  total_contacts int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  block_rate float NOT NULL DEFAULT 0,
  quality_at_send text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, batch_date)
);

-- ============================================================
-- 6. RLS policies
-- ============================================================

ALTER TABLE public.campaign_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_daily_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own sequence steps through campaigns"
  ON public.campaign_sequence_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_sequence_steps.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_sequence_steps.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users own campaign jobs through campaigns"
  ON public.campaign_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_jobs.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_jobs.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users own daily batches through campaigns"
  ON public.campaign_daily_batches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_daily_batches.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_daily_batches.campaign_id
        AND campaigns.user_id = auth.uid()
    )
  );
