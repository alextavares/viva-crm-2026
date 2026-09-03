export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Canonical Supabase contract: version-controlled baseline under
// supabase/migrations/20260830*_canonical_*.sql (9 migrations).
// This file is the truthful TypeScript projection of the PUBLIC and API
// schemas only. The PRIVATE schema (credentials, receipts, jobs, counters) is
// intentionally absent: it is not exposed over PostgREST
// (supabase/config.toml api.schemas) and must never be referenced by app code.
// Relationships are intentionally empty: join metadata is not part of the
// canonical app contract; tables, columns, views, and RPC signatures are.
export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_lead_messages: {
        Row: {
          author: string
          channel: string
          content: string
          created_at: string
          direction: string
          id: string
          organization_id: string
          payload: Json
          session_id: string
        }
        Insert: {
          author: string
          channel: string
          content: string
          created_at?: string
          direction: string
          id?: string
          organization_id: string
          payload?: Json
          session_id: string
        }
        Update: {
          author?: string
          channel?: string
          content?: string
          created_at?: string
          direction?: string
          id?: string
          organization_id?: string
          payload?: Json
          session_id?: string
        }
        Relationships: []
      }
      ai_lead_qualifications: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          city: string | null
          intent: string | null
          neighborhoods: string[]
          organization_id: string
          property_type: string | null
          session_id: string
          stage_score: number | null
          summary: string | null
          timeline: string | null
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          intent?: string | null
          neighborhoods?: string[]
          organization_id: string
          property_type?: string | null
          session_id: string
          stage_score?: number | null
          summary?: string | null
          timeline?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          intent?: string | null
          neighborhoods?: string[]
          organization_id?: string
          property_type?: string | null
          session_id?: string
          stage_score?: number | null
          summary?: string | null
          timeline?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_lead_sessions: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          contact_id: string
          created_at: string
          current_step: string | null
          handoff_completed_at: string | null
          handoff_requested_at: string | null
          id: string
          last_message_at: string | null
          organization_id: string
          paused_at: string | null
          qualified_at: string | null
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id: string
          created_at?: string
          current_step?: string | null
          handoff_completed_at?: string | null
          handoff_requested_at?: string | null
          id?: string
          last_message_at?: string | null
          organization_id: string
          paused_at?: string | null
          qualified_at?: string | null
          source: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step?: string | null
          handoff_completed_at?: string | null
          handoff_requested_at?: string | null
          id?: string
          last_message_at?: string | null
          organization_id?: string
          paused_at?: string | null
          qualified_at?: string | null
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_lead_settings: {
        Row: {
          created_at: string
          escalate_to_assigned: boolean
          first_delay_minutes: number
          first_template_id: string | null
          notify_manager: boolean
          organization_id: string
          reengagement_enabled: boolean
          response_sla_minutes: number
          second_delay_minutes: number
          second_template_id: string | null
          third_delay_minutes: number
          third_template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalate_to_assigned?: boolean
          first_delay_minutes?: number
          first_template_id?: string | null
          notify_manager?: boolean
          organization_id: string
          reengagement_enabled?: boolean
          response_sla_minutes?: number
          second_delay_minutes?: number
          second_template_id?: string | null
          third_delay_minutes?: number
          third_template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalate_to_assigned?: boolean
          first_delay_minutes?: number
          first_template_id?: string | null
          notify_manager?: boolean
          organization_id?: string
          reengagement_enabled?: boolean
          response_sla_minutes?: number
          second_delay_minutes?: number
          second_template_id?: string | null
          third_delay_minutes?: number
          third_template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          assigned_to: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          notes: string | null
          organization_id: string
          property_id: string | null
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          property_id?: string | null
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          property_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_events: {
        Row: {
          actor_profile_id: string | null
          contact_id: string
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
          source: string
        }
        Insert: {
          actor_profile_id?: string | null
          contact_id: string
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          source: string
        }
        Update: {
          actor_profile_id?: string | null
          contact_id?: string
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      contact_followups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          due_at: string
          id: string
          organization_id: string
          source: string | null
          status: string
          step: number
          template_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          due_at: string
          id?: string
          organization_id: string
          source?: string | null
          status?: string
          step: number
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          due_at?: string
          id?: string
          organization_id?: string
          source?: string | null
          status?: string
          step?: number
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          direction: string
          happened_at: string
          id: string
          metadata: Json
          organization_id: string
          summary: string
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          direction: string
          happened_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          summary: string
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          happened_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          summary?: string
          type?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          ai_last_summary: string | null
          ai_score: number | null
          ai_status: string | null
          assigned_to: string | null
          city: string | null
          created_at: string
          email: string | null
          handoff_at: string | null
          id: string
          interest_bedrooms: number | null
          interest_neighborhoods: string[]
          interest_price_max: number | null
          interest_type: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          phone_normalized: string | null
          qualified_by_ai_at: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          ai_last_summary?: string | null
          ai_score?: number | null
          ai_status?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          handoff_at?: string | null
          id?: string
          interest_bedrooms?: number | null
          interest_neighborhoods?: string[]
          interest_price_max?: number | null
          interest_type?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_normalized?: string | null
          qualified_by_ai_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          ai_last_summary?: string | null
          ai_score?: number | null
          ai_status?: string | null
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          handoff_at?: string | null
          id?: string
          interest_bedrooms?: number | null
          interest_neighborhoods?: string[]
          interest_price_max?: number | null
          interest_type?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_normalized?: string | null
          qualified_by_ai_at?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          accepted_proposal_id: string | null
          amount: number
          assigned_to: string | null
          commission_amount: number | null
          contract_type: string
          created_at: string
          document_path: string | null
          ends_at: string | null
          id: string
          opportunity_id: string
          organization_id: string
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_proposal_id?: string | null
          amount: number
          assigned_to?: string | null
          commission_amount?: number | null
          contract_type: string
          created_at?: string
          document_path?: string | null
          ends_at?: string | null
          id?: string
          opportunity_id: string
          organization_id: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_proposal_id?: string | null
          amount?: number
          assigned_to?: string | null
          commission_amount?: number | null
          contract_type?: string
          created_at?: string
          document_path?: string | null
          ends_at?: string | null
          id?: string
          opportunity_id?: string
          organization_id?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_domains: {
        Row: {
          created_at: string
          domain: string
          last_checked_at: string | null
          last_error: string | null
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          last_checked_at?: string | null
          last_error?: string | null
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          last_checked_at?: string | null
          last_error?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      followup_settings: {
        Row: {
          created_at: string
          enabled: boolean
          organization_id: string
          step_24h_template: string | null
          step_3d_template: string | null
          step_5m_template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          organization_id: string
          step_24h_template?: string | null
          step_3d_template?: string | null
          step_5m_template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          organization_id?: string
          step_24h_template?: string | null
          step_3d_template?: string | null
          step_5m_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      goal_profile_overrides: {
        Row: {
          appointments_target: number
          contacts_target: number
          contracts_target: number
          created_at: string
          enabled: boolean
          id: string
          organization_id: string
          period_type: string
          profile_id: string
          response_sla_minutes: number
          updated_at: string
        }
        Insert: {
          appointments_target?: number
          contacts_target?: number
          contracts_target?: number
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id: string
          period_type?: string
          profile_id: string
          response_sla_minutes?: number
          updated_at?: string
        }
        Update: {
          appointments_target?: number
          contacts_target?: number
          contracts_target?: number
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          period_type?: string
          profile_id?: string
          response_sla_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      goal_settings: {
        Row: {
          appointments_enabled: boolean
          appointments_target: number
          contacts_enabled: boolean
          contacts_target: number
          contracts_enabled: boolean
          contracts_target: number
          created_at: string
          enabled: boolean
          organization_id: string
          period_type: string
          response_sla_minutes: number
          updated_at: string
        }
        Insert: {
          appointments_enabled?: boolean
          appointments_target?: number
          contacts_enabled?: boolean
          contacts_target?: number
          contracts_enabled?: boolean
          contracts_target?: number
          created_at?: string
          enabled?: boolean
          organization_id: string
          period_type?: string
          response_sla_minutes?: number
          updated_at?: string
        }
        Update: {
          appointments_enabled?: boolean
          appointments_target?: number
          contacts_enabled?: boolean
          contacts_target?: number
          contracts_enabled?: boolean
          contracts_target?: number
          created_at?: string
          enabled?: boolean
          organization_id?: string
          period_type?: string
          response_sla_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_distribution_settings: {
        Row: {
          created_at: string
          default_assigned_to: string | null
          enabled: boolean
          mode: string
          organization_id: string
          redistribute_overdue: boolean
          sla_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_assigned_to?: string | null
          enabled?: boolean
          mode?: string
          organization_id: string
          redistribute_overdue?: boolean
          sla_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_assigned_to?: string | null
          enabled?: boolean
          mode?: string
          organization_id?: string
          redistribute_overdue?: boolean
          sla_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          channel: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          title: string
          updated_at: string
          variables: Json
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          title: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          channel: string
          contact_id: string
          created_at: string
          created_by: string | null
          direction: string
          external_message_id: string | null
          id: string
          organization_id: string
        }
        Insert: {
          body: string
          channel: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          direction: string
          external_message_id?: string | null
          id?: string
          organization_id: string
        }
        Update: {
          body?: string
          channel?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          external_message_id?: string | null
          id?: string
          organization_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          contact_id: string
          created_at: string
          estimated_value: number | null
          expected_close_date: string | null
          id: string
          loss_reason: string | null
          organization_id: string
          property_id: string | null
          source: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id: string
          created_at?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          organization_id: string
          property_id?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          contact_id?: string
          created_at?: string
          estimated_value?: number | null
          expected_close_date?: string | null
          id?: string
          loss_reason?: string | null
          organization_id?: string
          property_id?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_code: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_code?: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_code?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_integration_issues: {
        Row: {
          created_at: string
          human_message: string
          id: string
          is_resolved: boolean
          issue_key: string
          organization_id: string
          portal: string
          property_id: string | null
          resolved_at: string | null
          severity: string
          technical_message: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          human_message: string
          id?: string
          is_resolved?: boolean
          issue_key: string
          organization_id: string
          portal: string
          property_id?: string | null
          resolved_at?: string | null
          severity: string
          technical_message?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          human_message?: string
          id?: string
          is_resolved?: boolean
          issue_key?: string
          organization_id?: string
          portal?: string
          property_id?: string | null
          resolved_at?: string | null
          severity?: string
          technical_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_integration_runs: {
        Row: {
          bytes: number
          content_type: string | null
          created_at: string
          id: string
          kind: string
          message: string | null
          organization_id: string
          portal: string
          properties_count: number
          status: string
        }
        Insert: {
          bytes?: number
          content_type?: string | null
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          organization_id: string
          portal: string
          properties_count?: number
          status: string
        }
        Update: {
          bytes?: number
          content_type?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          organization_id?: string
          portal?: string
          properties_count?: number
          status?: string
        }
        Relationships: []
      }
      portal_integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          organization_id: string
          portal: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id: string
          portal: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id?: string
          portal?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          creci: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          public_display_name: string | null
          public_profile_enabled: boolean
          public_whatsapp: string | null
          response_time_label: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          organization_id: string
          public_display_name?: string | null
          public_profile_enabled?: boolean
          public_whatsapp?: string | null
          response_time_label?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          public_display_name?: string | null
          public_profile_enabled?: boolean
          public_whatsapp?: string | null
          response_time_label?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: Json
          assigned_to: string | null
          built_area: number | null
          created_at: string
          description: string | null
          external_id: string | null
          features: string[]
          financing_allowed: boolean
          id: string
          image_paths: string[]
          last_published_at: string | null
          organization_id: string
          owner_contact_id: string | null
          owner_name: string | null
          price: number | null
          public_code: string
          publication_error: string | null
          publication_status: string | null
          publish_imovelweb: boolean
          publish_olx: boolean
          publish_to_portals: boolean
          publish_to_site: boolean
          publish_zap: boolean
          status: string
          title: string
          total_area: number | null
          transaction_type: string
          type: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          assigned_to?: string | null
          built_area?: number | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          features?: string[]
          financing_allowed?: boolean
          id?: string
          image_paths?: string[]
          last_published_at?: string | null
          organization_id: string
          owner_contact_id?: string | null
          owner_name?: string | null
          price?: number | null
          public_code: string
          publication_error?: string | null
          publication_status?: string | null
          publish_imovelweb?: boolean
          publish_olx?: boolean
          publish_to_portals?: boolean
          publish_to_site?: boolean
          publish_zap?: boolean
          status?: string
          title: string
          total_area?: number | null
          transaction_type: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          assigned_to?: string | null
          built_area?: number | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          features?: string[]
          financing_allowed?: boolean
          id?: string
          image_paths?: string[]
          last_published_at?: string | null
          organization_id?: string
          owner_contact_id?: string | null
          owner_name?: string | null
          price?: number | null
          public_code?: string
          publication_error?: string | null
          publication_status?: string | null
          publish_imovelweb?: boolean
          publish_olx?: boolean
          publish_to_portals?: boolean
          publish_to_site?: boolean
          publish_zap?: boolean
          status?: string
          title?: string
          total_area?: number | null
          transaction_type?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          amount: number
          assigned_to: string | null
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string
          organization_id: string
          payment_terms: string | null
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          organization_id: string
          payment_terms?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          organization_id?: string
          payment_terms?: string | null
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      site_banners: {
        Row: {
          body: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_path: string | null
          is_active: boolean
          link_url: string | null
          organization_id: string
          placement: string
          priority: number
          starts_at: string | null
          title: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_url?: string | null
          organization_id: string
          placement: string
          priority?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          variant: string
        }
        Update: {
          body?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_url?: string | null
          organization_id?: string
          placement?: string
          priority?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      site_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          organization_id: string
          sort_order: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          organization_id: string
          sort_order?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          organization_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      site_news: {
        Row: {
          content: Json
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          organization_id: string
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          organization_id: string
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          organization_id?: string
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_pages: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_published: boolean
          key: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          key: string
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          key?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          analytics_id: string | null
          brand_name: string | null
          created_at: string
          description: string | null
          headline: string | null
          logo_path: string | null
          onboarding_complete: boolean
          organization_id: string
          primary_color: string | null
          public_address: string | null
          public_email: string | null
          public_phone: string | null
          secondary_color: string | null
          theme: string
          updated_at: string
          verification_id: string | null
        }
        Insert: {
          analytics_id?: string | null
          brand_name?: string | null
          created_at?: string
          description?: string | null
          headline?: string | null
          logo_path?: string | null
          onboarding_complete?: boolean
          organization_id: string
          primary_color?: string | null
          public_address?: string | null
          public_email?: string | null
          public_phone?: string | null
          secondary_color?: string | null
          theme?: string
          updated_at?: string
          verification_id?: string | null
        }
        Update: {
          analytics_id?: string | null
          brand_name?: string | null
          created_at?: string
          description?: string | null
          headline?: string | null
          logo_path?: string | null
          onboarding_complete?: boolean
          organization_id?: string
          primary_color?: string | null
          public_address?: string | null
          public_email?: string | null
          public_phone?: string | null
          secondary_color?: string | null
          theme?: string
          updated_at?: string
          verification_id?: string | null
        }
        Relationships: []
      }
      team_audit_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json
          organization_id: string
          target_profile_id: string | null
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json
          organization_id: string
          target_profile_id?: string | null
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json
          organization_id?: string
          target_profile_id?: string | null
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      whatsapp_addon_settings: {
        Row: {
          billing_timezone: string
          created_at: string
          currency: string
          enabled: boolean
          included_quota: number
          organization_id: string
          overage_price: number
          updated_at: string
        }
        Insert: {
          billing_timezone?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          included_quota?: number
          organization_id: string
          overage_price?: number
          updated_at?: string
        }
        Update: {
          billing_timezone?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          included_quota?: number
          organization_id?: string
          overage_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_channel_settings: {
        Row: {
          business_account_id: string | null
          created_at: string
          credential_last4: string | null
          display_phone: string | null
          last_error: string | null
          last_test_at: string | null
          operation_mode: string
          organization_id: string
          phone_number_id: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          business_account_id?: string | null
          created_at?: string
          credential_last4?: string | null
          display_phone?: string | null
          last_error?: string | null
          last_test_at?: string | null
          operation_mode?: string
          organization_id: string
          phone_number_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_account_id?: string | null
          created_at?: string
          credential_last4?: string | null
          display_phone?: string | null
          last_error?: string | null
          last_test_at?: string | null
          operation_mode?: string
          organization_id?: string
          phone_number_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      attendance_queue: {
        Row: {
          ai_status: string | null
          assigned_to: string | null
          contact_id: string
          last_activity_at: string
          name: string
          next_appointment_at: string | null
          next_followup_at: string | null
          organization_id: string
          status: string
        }
        Relationships: []
      }
      contact_pipeline_summary: {
        Row: {
          contact_id: string
          name: string
          opportunity_id: string | null
          organization_id: string
          stage: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_contact: {
        Args: { p_contact_id: string; p_expected_updated_at: string; p_new_assigned_to: string }
        Returns: Json
      }
      assign_opportunity: {
        Args: { p_expected_updated_at: string; p_new_assigned_to: string; p_opportunity_id: string }
        Returns: Json
      }
      claim_internal_jobs: {
        Args: { p_kind: string; p_max_jobs: number }
        Returns: {
          available_at: string
          id: string
          kind: string
          lock_token: string
          organization_id: string
          payload: Json
        }[]
      }
      complete_internal_job: {
        Args: { p_job_id: string; p_lock_token: string; p_result: Json }
        Returns: undefined
      }
      fail_internal_job: {
        Args: { p_error_code: string; p_job_id: string; p_lock_token: string; p_retry_at: string }
        Returns: undefined
      }
      imovelweb_feed: {
        Args: { p_feed_secret: string; p_max_rows?: number; p_slug: string }
        Returns: {
          address: Json
          built_area: number | null
          description: string | null
          external_id: string | null
          image_paths: string[] | null
          price: number | null
          public_code: string
          publication_status: string | null
          title: string | null
          total_area: number | null
          transaction_type: string | null
          type: string | null
        }[]
      }
      imovelweb_ingest: {
        Args: {
          p_email: string | null
          p_event_id: string
          p_listing_ref: string | null
          p_message: string | null
          p_name: string
          p_phone: string
          p_received_at: string
          p_slug: string
          p_webhook_secret: string
        }
        Returns: Json
      }
      rotate_integration_credential: {
        Args: { p_provider: string; p_purpose: string }
        Returns: { credential_id: string; last4: string; secret_once: string }[]
      }
      site_create_lead: {
        Args: {
          p_email: string | null
          p_idempotency_key: string | null
          p_message: string | null
          p_name: string
          p_phone: string
          p_property_id: string | null
          p_slug: string
          p_source_domain: string | null
        }
        Returns: Json
      }
      site_get_news: {
        Args: { p_slug: string; p_slug_key: string }
        Returns: Json
      }
      site_get_property: {
        Args: { p_property_id: string; p_slug: string }
        Returns: Json
      }
      site_get_settings: {
        Args: { p_slug: string }
        Returns: Json
      }
      site_list_links: {
        Args: { p_slug: string }
        Returns: Json[]
      }
      site_list_news: {
        Args: { p_page?: number; p_page_size?: number; p_slug: string }
        Returns: Json[]
      }
      site_list_properties: {
        Args: { p_page?: number; p_page_size?: number; p_slug: string }
        Returns: Json[]
      }
      site_resolve_slug_by_domain: {
        Args: { p_domain: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      claimed_job: {
        available_at: string
        id: string
        kind: string
        lock_token: string
        organization_id: string
        payload: Json
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
  api: {
    Enums: {},
  },
} as const
