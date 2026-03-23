export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          broker_id: string | null
          contact_id: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          organization_id: string
          property_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          broker_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          organization_id: string
          property_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          broker_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          property_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_seat_plan_changes: {
        Row: {
          action: string
          created_at: string
          currency_code: string
          effective_at: string
          id: string
          metadata: Json
          new_limit: number
          notes: string | null
          old_limit: number
          organization_id: string
          prorated_amount_cents: number
          proration_days_remaining: number
          proration_days_total: number
          requested_by: string | null
          status: string
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          currency_code?: string
          effective_at: string
          id?: string
          metadata?: Json
          new_limit: number
          notes?: string | null
          old_limit: number
          organization_id: string
          prorated_amount_cents?: number
          proration_days_remaining?: number
          proration_days_total?: number
          requested_by?: string | null
          status: string
          unit_price_cents?: number
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          currency_code?: string
          effective_at?: string
          id?: string
          metadata?: Json
          new_limit?: number
          notes?: string | null
          old_limit?: number
          organization_id?: string
          prorated_amount_cents?: number
          proration_days_remaining?: number
          proration_days_total?: number
          requested_by?: string | null
          status?: string
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_seat_plan_changes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_seat_plan_changes_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_seat_plans: {
        Row: {
          billing_cycle_anchor: string
          billing_cycle_interval: string
          broker_seat_limit: number
          created_at: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_cycle_anchor?: string
          billing_cycle_interval?: string
          broker_seat_limit: number
          created_at?: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_cycle_anchor?: string
          billing_cycle_interval?: string
          broker_seat_limit?: number
          created_at?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_seat_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_events: {
        Row: {
          contact_id: string
          created_at: string | null
          id: string
          organization_id: string
          payload: Json | null
          source: string | null
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          payload?: Json | null
          source?: string | null
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          payload?: Json | null
          source?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          direction: string | null
          happened_at: string
          id: string
          organization_id: string
          summary: string
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          direction?: string | null
          happened_at?: string
          id?: string
          organization_id: string
          summary: string
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string | null
          happened_at?: string
          id?: string
          organization_id?: string
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          city: string | null
          created_at: string | null
          deal_stage: string | null
          email: string | null
          id: string
          interest_bedrooms: number | null
          interest_neighborhoods: string[] | null
          interest_price_max: number | null
          interest_type: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          created_at?: string | null
          deal_stage?: string | null
          email?: string | null
          id?: string
          interest_bedrooms?: number | null
          interest_neighborhoods?: string[] | null
          interest_price_max?: number | null
          interest_type?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          created_at?: string | null
          deal_stage?: string | null
          email?: string | null
          id?: string
          interest_bedrooms?: number | null
          interest_neighborhoods?: string[] | null
          interest_price_max?: number | null
          interest_type?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "custom_domains_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_contracts: {
        Row: {
          broker_id: string | null
          commission_value: number | null
          contact_id: string
          contract_type: string | null
          created_at: string | null
          document_url: string | null
          end_date: string | null
          final_value: number
          id: string
          organization_id: string
          property_id: string
          proposal_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          broker_id?: string | null
          commission_value?: number | null
          contact_id: string
          contract_type?: string | null
          created_at?: string | null
          document_url?: string | null
          end_date?: string | null
          final_value: number
          id?: string
          organization_id: string
          property_id: string
          proposal_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          broker_id?: string | null
          commission_value?: number | null
          contact_id?: string
          contract_type?: string | null
          created_at?: string | null
          document_url?: string | null
          end_date?: string | null
          final_value?: number
          id?: string
          organization_id?: string
          property_id?: string
          proposal_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_contracts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contracts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "deal_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_proposals: {
        Row: {
          broker_id: string | null
          contact_id: string
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_conditions: string | null
          property_id: string | null
          proposed_value: number
          status: string | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          broker_id?: string | null
          contact_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_conditions?: string | null
          property_id?: string | null
          proposed_value: number
          status?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          broker_id?: string | null
          contact_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_conditions?: string | null
          property_id?: string | null
          proposed_value?: number
          status?: string | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_proposals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_proposals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_jobs: {
        Row: {
          contact_id: string
          created_at: string
          error: string | null
          id: string
          organization_id: string
          processed_at: string | null
          scheduled_at: string
          source: string
          status: string
          step: string
          template_body: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id: string
          processed_at?: string | null
          scheduled_at: string
          source?: string
          status?: string
          step: string
          template_body?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          error?: string | null
          id?: string
          organization_id?: string
          processed_at?: string | null
          scheduled_at?: string
          source?: string
          status?: string
          step?: string
          template_body?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_jobs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_settings: {
        Row: {
          created_at: string
          enabled: boolean
          organization_id: string
          step_24h_template: string
          step_3d_template: string
          step_5m_template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          organization_id: string
          step_24h_template?: string
          step_3d_template?: string
          step_5m_template?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          organization_id?: string
          step_24h_template?: string
          step_3d_template?: string
          step_5m_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_broker_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          metric_captacoes_enabled: boolean | null
          metric_respostas_enabled: boolean | null
          metric_visitas_enabled: boolean | null
          organization_id: string
          period_type: string | null
          profile_id: string
          response_sla_minutes: number | null
          target_captacoes: number | null
          target_respostas: number | null
          target_visitas: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          metric_captacoes_enabled?: boolean | null
          metric_respostas_enabled?: boolean | null
          metric_visitas_enabled?: boolean | null
          organization_id: string
          period_type?: string | null
          profile_id: string
          response_sla_minutes?: number | null
          target_captacoes?: number | null
          target_respostas?: number | null
          target_visitas?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          metric_captacoes_enabled?: boolean | null
          metric_respostas_enabled?: boolean | null
          metric_visitas_enabled?: boolean | null
          organization_id?: string
          period_type?: string | null
          profile_id?: string
          response_sla_minutes?: number | null
          target_captacoes?: number | null
          target_respostas?: number | null
          target_visitas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_broker_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_broker_overrides_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_settings: {
        Row: {
          created_at: string
          enabled: boolean
          metric_captacoes_enabled: boolean
          metric_respostas_enabled: boolean
          metric_visitas_enabled: boolean
          organization_id: string
          period_type: string
          response_sla_minutes: number
          target_captacoes: number
          target_respostas: number
          target_visitas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          metric_captacoes_enabled?: boolean
          metric_respostas_enabled?: boolean
          metric_visitas_enabled?: boolean
          organization_id: string
          period_type?: string
          response_sla_minutes?: number
          target_captacoes?: number
          target_respostas?: number
          target_visitas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          metric_captacoes_enabled?: boolean
          metric_respostas_enabled?: boolean
          metric_visitas_enabled?: boolean
          organization_id?: string
          period_type?: string
          response_sla_minutes?: number
          target_captacoes?: number
          target_respostas?: number
          target_visitas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_settings: {
        Row: {
          created_at: string
          enabled: boolean
          mode: string
          organization_id: string
          redistribute_overdue: boolean
          sla_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          mode?: string
          organization_id: string
          redistribute_overdue?: boolean
          sla_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          mode?: string
          organization_id?: string
          redistribute_overdue?: boolean
          sla_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_state: {
        Row: {
          last_assigned_profile_id: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          last_assigned_profile_id?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          last_assigned_profile_id?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_state_last_assigned_profile_id_fkey"
            columns: ["last_assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_interactions: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          lead_id: string
          organization_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id: string
          organization_id: string
          type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_response_metrics: {
        Row: {
          contact_id: string
          created_at: string
          first_response_at: string
          is_within_sla: boolean
          lead_event_at: string
          organization_id: string
          responder_profile_id: string | null
          response_kind: string
          sla_minutes: number
        }
        Insert: {
          contact_id: string
          created_at?: string
          first_response_at: string
          is_within_sla: boolean
          lead_event_at: string
          organization_id: string
          responder_profile_id?: string | null
          response_kind: string
          sla_minutes: number
        }
        Update: {
          contact_id?: string
          created_at?: string
          first_response_at?: string
          is_within_sla?: boolean
          lead_event_at?: string
          organization_id?: string
          responder_profile_id?: string | null
          response_kind?: string
          sla_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_response_metrics_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_response_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_response_metrics_responder_profile_id_fkey"
            columns: ["responder_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          email: string | null
          id: string
          last_contact_at: string | null
          last_contact_type: string | null
          name: string
          next_action_at: string | null
          next_action_note: string | null
          next_action_type: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          status: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contact_at?: string | null
          last_contact_type?: string | null
          name: string
          next_action_at?: string | null
          next_action_note?: string | null
          next_action_type?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_contact_at?: string | null
          last_contact_type?: string | null
          name?: string
          next_action_at?: string | null
          next_action_note?: string | null
          next_action_type?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          channel: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string
          title: string
          variables: string[] | null
        }
        Insert: {
          channel?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id: string
          title: string
          variables?: string[] | null
        }
        Update: {
          channel?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string
          title?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          contact_id: string
          created_at: string | null
          direction: string
          id: string
          organization_id: string
        }
        Insert: {
          body: string
          channel: string
          contact_id: string
          created_at?: string | null
          direction: string
          id?: string
          organization_id: string
        }
        Update: {
          body?: string
          channel?: string
          contact_id?: string
          created_at?: string | null
          direction?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          organization_id: string
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id: string
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          organization_id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          default_broker_id: string | null
          id: string
          lead_assignment_mode: string | null
          name: string
          plan: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          default_broker_id?: string | null
          id?: string
          lead_assignment_mode?: string | null
          name: string
          plan?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          default_broker_id?: string | null
          id?: string
          lead_assignment_mode?: string | null
          name?: string
          plan?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_default_broker_id_fkey"
            columns: ["default_broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_integration_issues: {
        Row: {
          created_at: string | null
          id: string
          is_resolved: boolean
          issue_key: string
          message_human: string
          message_technical: string | null
          organization_id: string
          portal: string
          property_id: string | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_resolved?: boolean
          issue_key: string
          message_human: string
          message_technical?: string | null
          organization_id: string
          portal: string
          property_id?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_resolved?: boolean
          issue_key?: string
          message_human?: string
          message_technical?: string | null
          organization_id?: string
          portal?: string
          property_id?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_integration_issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_integration_issues_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_integration_runs: {
        Row: {
          bytes: number
          content_type: string | null
          created_at: string | null
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
          created_at?: string | null
          id?: string
          kind?: string
          message?: string | null
          organization_id: string
          portal: string
          properties_count?: number
          status: string
        }
        Update: {
          bytes?: number
          content_type?: string | null
          created_at?: string | null
          id?: string
          kind?: string
          message?: string | null
          organization_id?: string
          portal?: string
          properties_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_integration_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_integrations: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          organization_id: string
          portal: string
          status: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id: string
          portal: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          organization_id?: string
          portal?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          organization_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: Json | null
          broker_id: string | null
          built_area: number | null
          created_at: string | null
          description: string | null
          external_id: string | null
          features: Json | null
          financing_allowed: boolean
          hide_from_site: boolean
          id: string
          image_paths: string[] | null
          images: string[] | null
          last_published_at: string | null
          operation: string
          organization_id: string
          owner_name: string | null
          price: number | null
          public_code: string
          publication_error: string | null
          publication_status: string
          publish_imovelweb: boolean
          publish_olx: boolean
          publish_to_portals: boolean
          publish_to_site: boolean
          publish_zap: boolean
          purpose: string | null
          status: string | null
          title: string
          total_area: number | null
          transaction_type: string | null
          type: string | null
        }
        Insert: {
          address?: Json | null
          broker_id?: string | null
          built_area?: number | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          features?: Json | null
          financing_allowed?: boolean
          hide_from_site?: boolean
          id?: string
          image_paths?: string[] | null
          images?: string[] | null
          last_published_at?: string | null
          operation?: string
          organization_id: string
          owner_name?: string | null
          price?: number | null
          public_code: string
          publication_error?: string | null
          publication_status?: string
          publish_imovelweb?: boolean
          publish_olx?: boolean
          publish_to_portals?: boolean
          publish_to_site?: boolean
          publish_zap?: boolean
          purpose?: string | null
          status?: string | null
          title: string
          total_area?: number | null
          transaction_type?: string | null
          type?: string | null
        }
        Update: {
          address?: Json | null
          broker_id?: string | null
          built_area?: number | null
          created_at?: string | null
          description?: string | null
          external_id?: string | null
          features?: Json | null
          financing_allowed?: boolean
          hide_from_site?: boolean
          id?: string
          image_paths?: string[] | null
          images?: string[] | null
          last_published_at?: string | null
          operation?: string
          organization_id?: string
          owner_name?: string | null
          price?: number | null
          public_code?: string
          publication_error?: string | null
          publication_status?: string
          publish_imovelweb?: boolean
          publish_olx?: boolean
          publish_to_portals?: boolean
          publish_to_site?: boolean
          publish_zap?: boolean
          purpose?: string | null
          status?: string | null
          title?: string
          total_area?: number | null
          transaction_type?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      property_public_code_sequences: {
        Row: {
          last_value: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_public_code_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_banners: {
        Row: {
          body: string | null
          created_at: string | null
          ends_at: string | null
          id: string
          image_path: string | null
          image_url: string | null
          is_active: boolean
          link_url: string | null
          organization_id: string
          placement: string
          priority: number
          starts_at: string | null
          title: string | null
          updated_at: string | null
          variant: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          organization_id: string
          placement: string
          priority?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string | null
          variant?: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          organization_id?: string
          placement?: string
          priority?: number
          starts_at?: string | null
          title?: string | null
          updated_at?: string | null
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_banners_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "site_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_news: {
        Row: {
          content: string
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
          content?: string
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
          content?: string
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
        Relationships: [
          {
            foreignKeyName: "site_news_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_published: boolean
          key: string
          organization_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean
          key: string
          organization_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean
          key?: string
          organization_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          brand_name: string | null
          created_at: string | null
          email: string | null
          facebook_domain_verification: string | null
          ga4_measurement_id: string | null
          google_ads_conversion_id: string | null
          google_ads_conversion_label: string | null
          google_site_verification: string | null
          logo_path: string | null
          logo_url: string | null
          meta_pixel_id: string | null
          onboarding_collapsed: boolean
          organization_id: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          theme: string
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          brand_name?: string | null
          created_at?: string | null
          email?: string | null
          facebook_domain_verification?: string | null
          ga4_measurement_id?: string | null
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          google_site_verification?: string | null
          logo_path?: string | null
          logo_url?: string | null
          meta_pixel_id?: string | null
          onboarding_collapsed?: boolean
          organization_id: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          theme?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          brand_name?: string | null
          created_at?: string | null
          email?: string | null
          facebook_domain_verification?: string | null
          ga4_measurement_id?: string | null
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          google_site_verification?: string | null
          logo_path?: string | null
          logo_url?: string | null
          meta_pixel_id?: string | null
          onboarding_collapsed?: boolean
          organization_id?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          theme?: string
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_audit_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          id: string
          level: string
          message: string | null
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
          message?: string | null
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
          message?: string | null
          metadata?: Json
          organization_id?: string
          target_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_audit_events_target_profile_id_fkey"
            columns: ["target_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_profile_id: string | null
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_accepted_profile_id_fkey"
            columns: ["accepted_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          source: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          source: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          source?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_addon_pricing_settings: {
        Row: {
          addon_enabled: boolean
          billing_timezone: string
          created_at: string
          currency_code: string
          included_quota: number
          organization_id: string
          overage_price: number
          updated_at: string
        }
        Insert: {
          addon_enabled?: boolean
          billing_timezone?: string
          created_at?: string
          currency_code?: string
          included_quota?: number
          organization_id: string
          overage_price?: number
          updated_at?: string
        }
        Update: {
          addon_enabled?: boolean
          billing_timezone?: string
          created_at?: string
          currency_code?: string
          included_quota?: number
          organization_id?: string
          overage_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_addon_pricing_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_channel_settings: {
        Row: {
          access_token: string | null
          access_token_last4: string | null
          business_account_id: string | null
          created_at: string
          display_phone: string | null
          last_error_message: string | null
          last_tested_at: string | null
          operation_mode: string
          organization_id: string
          phone_number_id: string | null
          provider: string
          status: string
          updated_at: string
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_last4?: string | null
          business_account_id?: string | null
          created_at?: string
          display_phone?: string | null
          last_error_message?: string | null
          last_tested_at?: string | null
          operation_mode?: string
          organization_id: string
          phone_number_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_last4?: string | null
          business_account_id?: string | null
          created_at?: string
          display_phone?: string | null
          last_error_message?: string | null
          last_tested_at?: string | null
          operation_mode?: string
          organization_id?: string
          phone_number_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_channel_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_usage_events: {
        Row: {
          channel: string
          created_at: string
          direction: string
          event_key: string
          id: string
          organization_id: string
          period_start_date: string
          timezone: string
          units: number
        }
        Insert: {
          channel?: string
          created_at?: string
          direction?: string
          event_key: string
          id?: string
          organization_id: string
          period_start_date: string
          timezone?: string
          units?: number
        }
        Update: {
          channel?: string
          created_at?: string
          direction?: string
          event_key?: string
          id?: string
          organization_id?: string
          period_start_date?: string
          timezone?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_usage_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_usage_monthly: {
        Row: {
          consumed_count: number
          created_at: string
          organization_id: string
          period_start_date: string
          timezone: string
          updated_at: string
        }
        Insert: {
          consumed_count?: number
          created_at?: string
          organization_id: string
          period_start_date: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          consumed_count?: number
          created_at?: string
          organization_id?: string
          period_start_date?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_usage_monthly_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_broker_seat_capacity: {
        Args: { p_extra?: number; p_org_id: string }
        Returns: boolean
      }
      count_active_brokers: { Args: { p_org_id: string }; Returns: number }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      feed_properties: {
        Args: { p_feed_token: string; p_portal: string }
        Returns: {
          address: Json | null
          broker_id: string | null
          built_area: number | null
          created_at: string | null
          description: string | null
          external_id: string | null
          features: Json | null
          financing_allowed: boolean
          hide_from_site: boolean
          id: string
          image_paths: string[] | null
          images: string[] | null
          last_published_at: string | null
          operation: string
          organization_id: string
          owner_name: string | null
          price: number | null
          public_code: string
          publication_error: string | null
          publication_status: string
          publish_imovelweb: boolean
          publish_olx: boolean
          publish_to_portals: boolean
          publish_to_site: boolean
          publish_zap: boolean
          purpose: string | null
          status: string | null
          title: string
          total_area: number | null
          transaction_type: string | null
          type: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "properties"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      followup_process_due: {
        Args: { p_limit?: number; p_org_id?: string }
        Returns: Json
      }
      followup_schedule_sequence: {
        Args: {
          p_contact_id: string
          p_org_id: string
          p_source?: string
          p_start_at?: string
        }
        Returns: Json
      }
      get_auth_org_id: { Args: never; Returns: string }
      get_broker_seat_usage: {
        Args: { p_org_id: string }
        Returns: {
          available: number
          seat_limit: number
          used: number
        }[]
      }
      goal_mark_first_response: {
        Args: {
          p_contact_id: string
          p_org_id: string
          p_response_at: string
          p_response_kind: string
        }
        Returns: Json
      }
      goals_dashboard_snapshot: {
        Args: { p_org_id?: string; p_profile_id?: string }
        Returns: Json
      }
      lead_assign_next_broker: {
        Args: {
          p_contact_id: string
          p_force?: boolean
          p_org_id: string
          p_reason?: string
        }
        Returns: Json
      }
      lead_redistribute_overdue: {
        Args: { p_limit?: number; p_org_id?: string }
        Returns: Json
      }
      site_create_lead: {
        Args: {
          p_message?: string
          p_name?: string
          p_phone?: string
          p_property_id?: string
          p_site_slug: string
          p_source_domain?: string
        }
        Returns: Json
      }
      site_get_news: {
        Args: { p_news_slug: string; p_site_slug: string }
        Returns: Json
      }
      site_get_property: {
        Args: { p_property_id: string; p_site_slug: string }
        Returns: Json
      }
      site_get_settings: { Args: { p_site_slug: string }; Returns: Json }
      site_list_links: {
        Args: { p_site_slug: string }
        Returns: {
          description: string
          id: string
          sort_order: number
          title: string
          url: string
        }[]
      }
      site_list_news: {
        Args: { p_limit?: number; p_offset?: number; p_site_slug: string }
        Returns: {
          created_at: string
          excerpt: string
          id: string
          published_at: string
          slug: string
          title: string
        }[]
      }
      site_list_properties: {
        Args: {
          p_city?: string
          p_financing_allowed?: boolean
          p_limit?: number
          p_max_area?: number
          p_max_price?: number
          p_min_area?: number
          p_min_bedrooms?: number
          p_min_price?: number
          p_neighborhood?: string
          p_offset?: number
          p_q?: string
          p_site_slug: string
          p_transaction_type?: string
          p_type?: string
        }
        Returns: {
          area: number
          bathrooms: number
          bedrooms: number
          city: string
          id: string
          neighborhood: string
          price: number
          public_code: string
          state: string
          thumbnail_path: string
          thumbnail_url: string
          title: string
          type: string
        }[]
      }
      site_resolve_slug_by_domain: {
        Args: { p_domain: string }
        Returns: string
      }
      webhook_create_endpoint: {
        Args: { p_org_id: string; p_source: string }
        Returns: Json
      }
      webhook_ingest_lead: {
        Args: {
          p_email?: string
          p_external_id?: string
          p_message?: string
          p_name: string
          p_phone: string
          p_property_id?: string
          p_source: string
          p_token: string
        }
        Returns: Json
      }
      whatsapp_record_send_event: {
        Args: {
          p_event_at?: string
          p_event_key: string
          p_organization_id: string
          p_units?: number
        }
        Returns: Json
      }
      whatsapp_send_policy_check: {
        Args: { p_now?: string; p_organization_id: string; p_units?: number }
        Returns: Json
      }
      whatsapp_usage_period_start: {
        Args: { p_now?: string; p_timezone?: string }
        Returns: string
      }
      whatsapp_usage_snapshot: {
        Args: { p_now?: string; p_organization_id?: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
} as const
