export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      contacts: {
        Row: {
          id: string;
          user_id: string;
          phone: string;
          name: string | null;
          optin_category: string;
          optin_source: string | null;
          optin_timestamp: string | null;
          tier_tag: string;
          last_message_at: string | null;
          block_count: number;
          engagement_score: number;
          last_campaign_sent_at: string | null;
          freq_capped_until: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phone: string;
          name?: string | null;
          optin_category?: string;
          optin_source?: string | null;
          optin_timestamp?: string | null;
          tier_tag?: string;
          last_message_at?: string | null;
          block_count?: number;
          engagement_score?: number;
          last_campaign_sent_at?: string | null;
          freq_capped_until?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
      };
      contact_custom_fields: {
        Row: {
          id: string;
          contact_id: string;
          field_key: string;
          field_value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          field_key: string;
          field_value: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contact_custom_fields"]["Insert"]>;
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          template_id: string | null;
          template_name: string | null;
          status: string;
          start_date: string | null;
          end_date: string | null;
          daily_limit: number;
          cooldown_days: number;
          scheduled_at: string | null;
          total_sent: number;
          total_delivered: number;
          total_read: number;
          total_responded: number;
          total_failed: number;
          connector_id: string | null;
          fallback_connector_id: string | null;
          template_ids: Json;
          variable_mappings: Json;
          audience_segment_ids: string[];
          audience_tag_filter: string[];
          audience_custom_filter: Json;
          exclude_tags: string[];
          cooldown_hours: number;
          max_messages_per_contact: number;
          send_window_start: string;
          send_window_end: string;
          priority_mode: string;
          priority_weights: Json;
          plan_json: Json | null;
          plan_generated_at: string | null;
          launched_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category?: string;
          template_id?: string | null;
          template_name?: string | null;
          status?: string;
          start_date?: string | null;
          end_date?: string | null;
          daily_limit?: number;
          cooldown_days?: number;
          scheduled_at?: string | null;
          total_sent?: number;
          total_delivered?: number;
          total_read?: number;
          total_responded?: number;
          total_failed?: number;
          connector_id?: string | null;
          fallback_connector_id?: string | null;
          template_ids?: Json;
          variable_mappings?: Json;
          audience_segment_ids?: string[];
          audience_tag_filter?: string[];
          audience_custom_filter?: Json;
          exclude_tags?: string[];
          cooldown_hours?: number;
          max_messages_per_contact?: number;
          send_window_start?: string;
          send_window_end?: string;
          priority_mode?: string;
          priority_weights?: Json;
          plan_json?: Json | null;
          plan_generated_at?: string | null;
          launched_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
      };
      campaign_sequence_steps: {
        Row: {
          id: string;
          campaign_id: string;
          step_order: number;
          template_id: string | null;
          template_name: string | null;
          day_offset: number;
          condition: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          step_order?: number;
          template_id?: string | null;
          template_name?: string | null;
          day_offset?: number;
          condition?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_sequence_steps"]["Insert"]>;
      };
      campaign_jobs: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          contact_phone: string;
          sequence_step: number;
          scheduled_at: string;
          executed_at: string | null;
          status: string;
          connector_used: string | null;
          skip_reason: string | null;
          error_code: string | null;
          message_log_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          contact_id: string;
          contact_phone: string;
          sequence_step?: number;
          scheduled_at: string;
          executed_at?: string | null;
          status?: string;
          connector_used?: string | null;
          skip_reason?: string | null;
          error_code?: string | null;
          message_log_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_jobs"]["Insert"]>;
      };
      campaign_daily_batches: {
        Row: {
          id: string;
          campaign_id: string;
          batch_date: string;
          total_contacts: number;
          sent: number;
          delivered: number;
          failed: number;
          block_rate: number;
          quality_at_send: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          batch_date: string;
          total_contacts?: number;
          sent?: number;
          delivered?: number;
          failed?: number;
          block_rate?: number;
          quality_at_send?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_daily_batches"]["Insert"]>;
      };
      message_log: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          contact_phone: string;
          status: string;
          error_code: string | null;
          connector_used: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          read_at: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          contact_id: string;
          contact_phone: string;
          status?: string;
          error_code?: string | null;
          connector_used?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          read_at?: string | null;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_log"]["Insert"]>;
      };
      journeys: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: string;
          graph_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          status?: string;
          graph_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["journeys"]["Insert"]>;
      };
      segments: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          filter_query: string;
          contact_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          filter_query: string;
          contact_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["segments"]["Insert"]>;
      };
      optin_audit_log: {
        Row: {
          id: string;
          contact_id: string;
          from_state: string;
          to_state: string;
          source: string;
          channel: string;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          from_state: string;
          to_state: string;
          source: string;
          channel: string;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["optin_audit_log"]["Insert"]>;
      };
      connectors: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          status: string;
          is_fallback: boolean;
          config_encrypted: Json;
          last_successful_send: string | null;
          error_rate_24h: number;
          messaging_tier: string | null;
          quality_rating: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          status?: string;
          is_fallback?: boolean;
          config_encrypted?: Json;
          last_successful_send?: string | null;
          error_rate_24h?: number;
          messaging_tier?: string | null;
          quality_rating?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["connectors"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
