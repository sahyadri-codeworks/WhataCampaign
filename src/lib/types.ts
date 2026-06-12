export type OptinCategory = 'none' | 'utility_only' | 'marketing' | 'double_confirmed' | 'opted_out';

export type Contact = {
  id: string;
  phone: string;
  name?: string;
  optin_category: OptinCategory;
  optin_source?: string;
  optin_timestamp?: string;
  tier_tag: 'VIP' | 'Regular' | 'New';
  last_message_at?: string;
  block_count: number;
  custom_fields: Record<string, string>;
  extraData: Record<string, string>;
};

export type CampaignConfig = {
  name: string;
  startDate: string;
  endDate: string;
  dailyLimit: number;
  cooldownDays: number;
};

export type ContactHistory = {
  phone: string;
  lastSentAt: string;
};

export type ScheduleBatch = {
  day: number;
  date: string;
  contacts: Contact[];
};

export type ScheduleResult = {
  batches: ScheduleBatch[];
  skippedContacts: Contact[];
  errors: string[];
};

export type AiScreenResult = {
  score: number;
  flags: string[];
  suggestion: string;
  source?: "gemini" | "local";
};

export type TemplateCategory = 'Marketing' | 'Utility' | 'Authentication';

export type MessageTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  body: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
};

export type Campaign = {
  id: string;
  name: string;
  category: TemplateCategory;
  template_id: string;
  template_name: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused';
  delivery_pct: number;
  created_at: string;
  scheduled_at?: string;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_responded: number;
  total_failed: number;
};

export type AiReviewResult = {
  score: number;
  issues: string[];
  suggestions: string[];
  estimated_delivery_boost: string;
};

export type MessageLog = {
  id: string;
  campaign_id: string;
  contact_id: string;
  contact_phone: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'responded';
  error_code?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  responded_at?: string;
};

export type QualityRating = 'GREEN' | 'YELLOW' | 'RED';

export type ConnectorType = 'meta_cloud_api' | '360dialog' | 'wati' | 'interakt' | 'crm_webhook';

export type Connector = {
  id: string;
  name: string;
  type: ConnectorType;
  status: 'active' | 'inactive' | 'error';
  phone_number_id?: string;
  access_token?: string;
  webhook_verify_token?: string;
  base_url?: string;
  is_fallback: boolean;
  last_successful_send?: string;
  error_rate_24h: number;
  messaging_tier?: string;
  quality_rating?: QualityRating;
};

export type JourneyNodeType =
  | 'trigger_inbound'
  | 'trigger_click_wa'
  | 'trigger_api_event'
  | 'trigger_segment'
  | 'action_send_template'
  | 'action_send_reply'
  | 'action_add_tag'
  | 'action_remove_tag'
  | 'action_update_field'
  | 'action_trigger_webhook'
  | 'condition_optin'
  | 'condition_delivered'
  | 'condition_replied'
  | 'condition_time'
  | 'condition_field'
  | 'wait_delay'
  | 'wait_event';

export type Journey = {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at: string;
  trigger_count: number;
  nodes_count: number;
};

export type Segment = {
  id: string;
  name: string;
  filter_query: string;
  contact_count: number;
  created_at: string;
};

export type OptinAuditEntry = {
  id: string;
  contact_id: string;
  timestamp: string;
  from_state: OptinCategory;
  to_state: OptinCategory;
  source: string;
  channel: string;
};
