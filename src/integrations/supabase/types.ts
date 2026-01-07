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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_type: Database["public"]["Enums"]["automation_action_type"]
          conditions: Json | null
          created_at: string
          enabled: boolean
          field_mappings: Json
          id: string
          incoming_webhook_id: string
          name: string
          payload_config: Json | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["automation_action_type"]
          conditions?: Json | null
          created_at?: string
          enabled?: boolean
          field_mappings?: Json
          id?: string
          incoming_webhook_id: string
          name: string
          payload_config?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["automation_action_type"]
          conditions?: Json | null
          created_at?: string
          enabled?: boolean
          field_mappings?: Json
          id?: string
          incoming_webhook_id?: string
          name?: string
          payload_config?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_incoming_webhook_id_fkey"
            columns: ["incoming_webhook_id"]
            isOneToOne: false
            referencedRelation: "incoming_webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_incoming_webhook_id_fkey"
            columns: ["incoming_webhook_id"]
            isOneToOne: false
            referencedRelation: "incoming_webhooks_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_materials: {
        Row: {
          batch_number: string
          created_at: string | null
          id: string
          material_type: string
          opening_date: string | null
          production_step_id: string | null
          scanned_at: string | null
          scanned_by: string | null
          work_order_item_id: string
        }
        Insert: {
          batch_number: string
          created_at?: string | null
          id?: string
          material_type: string
          opening_date?: string | null
          production_step_id?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          work_order_item_id: string
        }
        Update: {
          batch_number?: string
          created_at?: string | null
          id?: string
          material_type?: string
          opening_date?: string | null
          production_step_id?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          work_order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_materials_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_materials_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          detected_fields: string[] | null
          field_mappings: Json
          id: string
          is_default: boolean
          name: string
          product_type: string | null
          template_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          detected_fields?: string[] | null
          field_mappings?: Json
          id?: string
          is_default?: boolean
          name: string
          product_type?: string | null
          template_url: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          detected_fields?: string[] | null
          field_mappings?: Json
          id?: string
          is_default?: boolean
          name?: string
          product_type?: string | null
          template_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          created_at: string
          id: string
          item_text_en: string
          item_text_nl: string
          production_step_id: string
          required: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_text_en: string
          item_text_nl: string
          production_step_id: string
          required?: boolean
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: string
          item_text_en?: string
          item_text_nl?: string
          production_step_id?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_responses: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          checklist_item_id: string
          created_at: string
          id: string
          step_execution_id: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          checklist_item_id: string
          created_at?: string
          id?: string
          step_execution_id: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          checklist_item_id?: string
          created_at?: string
          id?: string
          step_execution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_responses_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_responses_step_execution_id_fkey"
            columns: ["step_execution_id"]
            isOneToOne: false
            referencedRelation: "step_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json | null
          created_at: string | null
          email: string | null
          exact_customer_id: string
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          name: string
          name_nl: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string | null
          email?: string | null
          exact_customer_id: string
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name: string
          name_nl?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string | null
          email?: string | null
          exact_customer_id?: string
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          name?: string
          name_nl?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      incoming_webhooks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          enabled: boolean
          endpoint_key: string
          id: string
          last_triggered_at: string | null
          name: string
          secret_key: string
          trigger_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          enabled?: boolean
          endpoint_key?: string
          id?: string
          last_triggered_at?: string | null
          name: string
          secret_key?: string
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          enabled?: boolean
          endpoint_key?: string
          id?: string
          last_triggered_at?: string | null
          name?: string
          secret_key?: string
          trigger_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      instruction_media: {
        Row: {
          alt_text_en: string | null
          alt_text_nl: string | null
          created_at: string
          id: string
          instruction_step_id: string
          media_type: string
          sort_order: number
          thumbnail_url: string | null
          title_en: string | null
          title_nl: string | null
          url: string
        }
        Insert: {
          alt_text_en?: string | null
          alt_text_nl?: string | null
          created_at?: string
          id?: string
          instruction_step_id: string
          media_type: string
          sort_order?: number
          thumbnail_url?: string | null
          title_en?: string | null
          title_nl?: string | null
          url: string
        }
        Update: {
          alt_text_en?: string | null
          alt_text_nl?: string | null
          created_at?: string
          id?: string
          instruction_step_id?: string
          media_type?: string
          sort_order?: number
          thumbnail_url?: string | null
          title_en?: string | null
          title_nl?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruction_media_instruction_step_id_fkey"
            columns: ["instruction_step_id"]
            isOneToOne: false
            referencedRelation: "instruction_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      instruction_steps: {
        Row: {
          content_en: string | null
          content_nl: string | null
          created_at: string
          estimated_duration_minutes: number | null
          id: string
          required_tools: string[] | null
          sort_order: number
          step_number: number
          tip_text_en: string | null
          tip_text_nl: string | null
          title_en: string
          title_nl: string | null
          updated_at: string
          warning_text_en: string | null
          warning_text_nl: string | null
          work_instruction_id: string
        }
        Insert: {
          content_en?: string | null
          content_nl?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          required_tools?: string[] | null
          sort_order?: number
          step_number: number
          tip_text_en?: string | null
          tip_text_nl?: string | null
          title_en: string
          title_nl?: string | null
          updated_at?: string
          warning_text_en?: string | null
          warning_text_nl?: string | null
          work_instruction_id: string
        }
        Update: {
          content_en?: string | null
          content_nl?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          required_tools?: string[] | null
          sort_order?: number
          step_number?: number
          tip_text_en?: string | null
          tip_text_nl?: string | null
          title_en?: string
          title_nl?: string | null
          updated_at?: string
          warning_text_en?: string | null
          warning_text_nl?: string | null
          work_instruction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruction_steps_work_instruction_id_fkey"
            columns: ["work_instruction_id"]
            isOneToOne: false
            referencedRelation: "work_instructions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          material_id: string
          opening_date: string | null
          quantity_on_hand: number
          quantity_reserved: number
          received_date: string | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          material_id: string
          opening_date?: string | null
          quantity_on_hand?: number
          quantity_reserved?: number
          received_date?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          material_id?: string
          opening_date?: string | null
          quantity_on_hand?: number
          quantity_reserved?: number
          received_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          batch_number: string | null
          created_at: string
          id: string
          inventory_stock_id: string | null
          material_id: string
          notes: string | null
          performed_by: string | null
          production_step_id: string | null
          quantity: number
          quantity_after: number | null
          quantity_before: number | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          work_order_id: string | null
          work_order_item_id: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          id?: string
          inventory_stock_id?: string | null
          material_id: string
          notes?: string | null
          performed_by?: string | null
          production_step_id?: string | null
          quantity: number
          quantity_after?: number | null
          quantity_before?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          work_order_id?: string | null
          work_order_item_id?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          id?: string
          inventory_stock_id?: string | null
          material_id?: string
          notes?: string | null
          performed_by?: string | null
          production_step_id?: string | null
          quantity?: number
          quantity_after?: number | null
          quantity_before?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          work_order_id?: string | null
          work_order_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_inventory_stock_id_fkey"
            columns: ["inventory_stock_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          lead_time_days: number | null
          material_type: string
          min_order_quantity: number
          name: string
          name_nl: string | null
          reorder_point: number
          reorder_quantity: number | null
          shelf_life_days: number | null
          sku: string
          supplier_name: string | null
          supplier_sku: string | null
          track_batches: boolean
          track_expiry: boolean
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_time_days?: number | null
          material_type: string
          min_order_quantity?: number
          name: string
          name_nl?: string | null
          reorder_point?: number
          reorder_quantity?: number | null
          shelf_life_days?: number | null
          sku: string
          supplier_name?: string | null
          supplier_sku?: string | null
          track_batches?: boolean
          track_expiry?: boolean
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_time_days?: number | null
          material_type?: string
          min_order_quantity?: number
          name?: string
          name_nl?: string | null
          reorder_point?: number
          reorder_quantity?: number | null
          shelf_life_days?: number | null
          sku?: string
          supplier_name?: string | null
          supplier_sku?: string | null
          track_batches?: boolean
          track_expiry?: boolean
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      operator_assignments: {
        Row: {
          assigned_date: string
          created_at: string
          id: string
          operator_id: string
          planned_hours: number
          updated_at: string
          work_order_id: string
        }
        Insert: {
          assigned_date: string
          created_at?: string
          id?: string
          operator_id: string
          planned_hours?: number
          updated_at?: string
          work_order_id: string
        }
        Update: {
          assigned_date?: string
          created_at?: string
          id?: string
          operator_id?: string
          planned_hours?: number
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_availability: {
        Row: {
          available_hours: number
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          reason: string | null
          reason_type: string
          user_id: string
        }
        Insert: {
          available_hours?: number
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          reason?: string | null
          reason_type?: string
          user_id: string
        }
        Update: {
          available_hours?: number
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          reason?: string | null
          reason_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_availability_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outgoing_webhook_logs: {
        Row: {
          attempts: number | null
          created_at: string | null
          delivery_id: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: Json | null
          response_status: number | null
          response_time_ms: number | null
          webhook_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          delivery_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          response_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          webhook_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          delivery_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outgoing_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "zapier_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string
          description?: string | null
          id: string
          name: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      production_steps: {
        Row: {
          batch_type: string | null
          blocks_on_failure: boolean | null
          conditional_on_step: number | null
          conditional_value: string | null
          created_at: string
          description_en: string | null
          description_nl: string | null
          has_checklist: boolean
          id: string
          measurement_fields: Json | null
          product_type: Database["public"]["Enums"]["product_type"]
          requires_barcode_scan: boolean
          requires_batch_number: boolean
          requires_value_input: boolean
          restart_from_step: number | null
          sort_order: number
          step_number: number
          title_en: string
          title_nl: string
          validation_rules: Json | null
          value_label_en: string | null
          value_label_nl: string | null
          value_unit: string | null
        }
        Insert: {
          batch_type?: string | null
          blocks_on_failure?: boolean | null
          conditional_on_step?: number | null
          conditional_value?: string | null
          created_at?: string
          description_en?: string | null
          description_nl?: string | null
          has_checklist?: boolean
          id?: string
          measurement_fields?: Json | null
          product_type: Database["public"]["Enums"]["product_type"]
          requires_barcode_scan?: boolean
          requires_batch_number?: boolean
          requires_value_input?: boolean
          restart_from_step?: number | null
          sort_order: number
          step_number: number
          title_en: string
          title_nl: string
          validation_rules?: Json | null
          value_label_en?: string | null
          value_label_nl?: string | null
          value_unit?: string | null
        }
        Update: {
          batch_type?: string | null
          blocks_on_failure?: boolean | null
          conditional_on_step?: number | null
          conditional_value?: string | null
          created_at?: string
          description_en?: string | null
          description_nl?: string | null
          has_checklist?: boolean
          id?: string
          measurement_fields?: Json | null
          product_type?: Database["public"]["Enums"]["product_type"]
          requires_barcode_scan?: boolean
          requires_batch_number?: boolean
          requires_value_input?: boolean
          restart_from_step?: number | null
          sort_order?: number
          step_number?: number
          title_en?: string
          title_nl?: string
          validation_rules?: Json | null
          value_label_en?: string | null
          value_label_nl?: string | null
          value_unit?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          created_at: string | null
          description: string | null
          exact_item_id: string
          id: string
          is_active: boolean | null
          item_code: string
          items_group: string | null
          last_synced_at: string | null
          name: string
          name_nl: string | null
          product_type: string
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          description?: string | null
          exact_item_id: string
          id?: string
          is_active?: boolean | null
          item_code: string
          items_group?: string | null
          last_synced_at?: string | null
          name: string
          name_nl?: string | null
          product_type?: string
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          description?: string | null
          exact_item_id?: string
          id?: string
          is_active?: boolean | null
          item_code?: string
          items_group?: string | null
          last_synced_at?: string | null
          name?: string
          name_nl?: string | null
          product_type?: string
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          daily_capacity_hours: number
          full_name: string
          id: string
          is_available: boolean
          language: string
          notification_prefs: Json | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          view_preferences: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          daily_capacity_hours?: number
          full_name: string
          id: string
          is_available?: boolean
          language?: string
          notification_prefs?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          view_preferences?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          daily_capacity_hours?: number
          full_name?: string
          id?: string
          is_available?: boolean
          language?: string
          notification_prefs?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          view_preferences?: Json | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quality_certificates: {
        Row: {
          certificate_data: Json
          created_at: string | null
          generated_at: string | null
          generated_by: string | null
          id: string
          pdf_url: string | null
          work_order_item_id: string
        }
        Insert: {
          certificate_data: Json
          created_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          work_order_item_id: string
        }
        Update: {
          certificate_data?: Json
          created_at?: string | null
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          work_order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_certificates_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted: boolean
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          granted?: boolean
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          granted?: boolean
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      step_executions: {
        Row: {
          barcode_scanned: string | null
          batch_number: string | null
          completed_at: string | null
          created_at: string
          executed_by: string | null
          id: string
          measurement_values: Json | null
          notes: string | null
          operator_initials:
            | Database["public"]["Enums"]["operator_initials"]
            | null
          production_step_id: string
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          validation_message: string | null
          validation_status: string | null
          value_recorded: string | null
          work_order_item_id: string
        }
        Insert: {
          barcode_scanned?: string | null
          batch_number?: string | null
          completed_at?: string | null
          created_at?: string
          executed_by?: string | null
          id?: string
          measurement_values?: Json | null
          notes?: string | null
          operator_initials?:
            | Database["public"]["Enums"]["operator_initials"]
            | null
          production_step_id: string
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          validation_message?: string | null
          validation_status?: string | null
          value_recorded?: string | null
          work_order_item_id: string
        }
        Update: {
          barcode_scanned?: string | null
          batch_number?: string | null
          completed_at?: string | null
          created_at?: string
          executed_by?: string | null
          id?: string
          measurement_values?: Json | null
          notes?: string | null
          operator_initials?:
            | Database["public"]["Enums"]["operator_initials"]
            | null
          production_step_id?: string
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          validation_message?: string | null
          validation_status?: string | null
          value_recorded?: string | null
          work_order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_executions_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_executions_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_assemblies: {
        Row: {
          child_item_id: string
          component_type: Database["public"]["Enums"]["product_type"]
          id: string
          linked_at: string
          linked_by: string | null
          parent_item_id: string
        }
        Insert: {
          child_item_id: string
          component_type: Database["public"]["Enums"]["product_type"]
          id?: string
          linked_at?: string
          linked_by?: string | null
          parent_item_id: string
        }
        Update: {
          child_item_id?: string
          component_type?: Database["public"]["Enums"]["product_type"]
          id?: string
          linked_at?: string
          linked_by?: string | null
          parent_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_assemblies_child_item_id_fkey"
            columns: ["child_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_assemblies_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_configurations: {
        Row: {
          created_at: string
          enabled: boolean
          frequency: string
          id: string
          last_synced_at: string | null
          next_sync_at: string | null
          scheduled_time: string | null
          sync_type: string
          timezone: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_synced_at?: string | null
          next_sync_at?: string | null
          scheduled_time?: string | null
          sync_type: string
          timezone?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          frequency?: string
          id?: string
          last_synced_at?: string | null
          next_sync_at?: string | null
          scheduled_time?: string | null
          sync_type?: string
          timezone?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          description_nl: string | null
          id: string
          is_active: boolean | null
          name: string
          name_nl: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_nl?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_nl?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_teams: {
        Row: {
          id: string
          is_lead: boolean | null
          joined_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_lead?: boolean | null
          joined_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_lead?: boolean | null
          joined_at?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          attempts: number | null
          code_hash: string
          code_type: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          max_attempts: number | null
          used_at: string | null
          user_agent: string | null
        }
        Insert: {
          attempts?: number | null
          code_hash: string
          code_type: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          ip_address?: string | null
          max_attempts?: number | null
          used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          attempts?: number | null
          code_hash?: string
          code_type?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          max_attempts?: number | null
          used_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          executed_rules: Json | null
          id: string
          incoming_webhook_id: string
          is_test: boolean | null
          request_body: Json | null
          request_headers: Json | null
          response_body: Json | null
          response_status: number | null
          response_time_ms: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          executed_rules?: Json | null
          id?: string
          incoming_webhook_id: string
          is_test?: boolean | null
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          executed_rules?: Json | null
          id?: string
          incoming_webhook_id?: string
          is_test?: boolean | null
          request_body?: Json | null
          request_headers?: Json | null
          response_body?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_incoming_webhook_id_fkey"
            columns: ["incoming_webhook_id"]
            isOneToOne: false
            referencedRelation: "incoming_webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_incoming_webhook_id_fkey"
            columns: ["incoming_webhook_id"]
            isOneToOne: false
            referencedRelation: "incoming_webhooks_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      work_instructions: {
        Row: {
          created_at: string
          created_by: string | null
          description_en: string | null
          description_nl: string | null
          id: string
          is_active: boolean
          product_type: Database["public"]["Enums"]["product_type"]
          production_step_id: string | null
          sort_order: number
          title_en: string
          title_nl: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean
          product_type: Database["public"]["Enums"]["product_type"]
          production_step_id?: string | null
          sort_order?: number
          title_en: string
          title_nl?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean
          product_type?: Database["public"]["Enums"]["product_type"]
          production_step_id?: string | null
          sort_order?: number
          title_en?: string
          title_nl?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_instructions_production_step_id_fkey"
            columns: ["production_step_id"]
            isOneToOne: false
            referencedRelation: "production_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_items: {
        Row: {
          assigned_to: string | null
          batch_assigned_at: string | null
          batch_number: string | null
          certificate_generated: boolean
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          label_printed: boolean
          label_printed_at: string | null
          label_printed_by: string | null
          operator_initials:
            | Database["public"]["Enums"]["operator_initials"]
            | null
          position_in_batch: number
          product_type: string | null
          quality_approved: boolean
          serial_number: string
          status: Database["public"]["Enums"]["work_order_status"]
          updated_at: string
          work_order_id: string
        }
        Insert: {
          assigned_to?: string | null
          batch_assigned_at?: string | null
          batch_number?: string | null
          certificate_generated?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          label_printed?: boolean
          label_printed_at?: string | null
          label_printed_by?: string | null
          operator_initials?:
            | Database["public"]["Enums"]["operator_initials"]
            | null
          position_in_batch: number
          product_type?: string | null
          quality_approved?: boolean
          serial_number: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          work_order_id: string
        }
        Update: {
          assigned_to?: string | null
          batch_assigned_at?: string | null
          batch_number?: string | null
          certificate_generated?: boolean
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          label_printed?: boolean
          label_printed_at?: string | null
          label_printed_by?: string | null
          operator_initials?:
            | Database["public"]["Enums"]["operator_initials"]
            | null
          position_in_batch?: number
          product_type?: string | null
          quality_approved?: boolean
          serial_number?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          reply_to_id: string | null
          step_number: number | null
          type: string
          updated_at: string
          user_id: string
          work_order_id: string
          work_order_item_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          reply_to_id?: string | null
          step_number?: number | null
          type?: string
          updated_at?: string
          user_id: string
          work_order_id: string
          work_order_item_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          reply_to_id?: string | null
          step_number?: number | null
          type?: string
          updated_at?: string
          user_id?: string
          work_order_id?: string
          work_order_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_notes_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "work_order_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_notes_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_notes_work_order_item_id_fkey"
            columns: ["work_order_item_id"]
            isOneToOne: false
            referencedRelation: "work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_to: string | null
          batch_size: number
          cancellation_reason: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string | null
          exact_shop_order_link: string | null
          exact_shop_order_number: string | null
          external_order_number: string | null
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          materials_issued_status: string | null
          materials_summary: Json | null
          notes: string | null
          order_value: number | null
          parent_wo_id: string | null
          product_id: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          production_ready_date: string | null
          scheduled_date: string | null
          shipping_date: string | null
          start_date: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["work_order_status"]
          sync_retry_count: number | null
          sync_status: string | null
          updated_at: string
          wo_number: string
        }
        Insert: {
          assigned_to?: string | null
          batch_size: number
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name?: string | null
          exact_shop_order_link?: string | null
          exact_shop_order_number?: string | null
          external_order_number?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          materials_issued_status?: string | null
          materials_summary?: Json | null
          notes?: string | null
          order_value?: number | null
          parent_wo_id?: string | null
          product_id?: string | null
          product_type: Database["public"]["Enums"]["product_type"]
          production_ready_date?: string | null
          scheduled_date?: string | null
          shipping_date?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          sync_retry_count?: number | null
          sync_status?: string | null
          updated_at?: string
          wo_number: string
        }
        Update: {
          assigned_to?: string | null
          batch_size?: number
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string | null
          exact_shop_order_link?: string | null
          exact_shop_order_number?: string | null
          external_order_number?: string | null
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          materials_issued_status?: string | null
          materials_summary?: Json | null
          notes?: string | null
          order_value?: number | null
          parent_wo_id?: string | null
          product_id?: string | null
          product_type?: Database["public"]["Enums"]["product_type"]
          production_ready_date?: string | null
          scheduled_date?: string | null
          shipping_date?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["work_order_status"]
          sync_retry_count?: number | null
          sync_status?: string | null
          updated_at?: string
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_parent_wo_id_fkey"
            columns: ["parent_wo_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      zapier_webhooks: {
        Row: {
          created_at: string
          created_by: string
          enabled: boolean
          event_type: string
          id: string
          name: string
          secret_key: string | null
          updated_at: string
          webhook_url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          enabled?: boolean
          event_type: string
          id?: string
          name: string
          secret_key?: string | null
          updated_at?: string
          webhook_url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          enabled?: boolean
          event_type?: string
          id?: string
          name?: string
          secret_key?: string | null
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      incoming_webhooks_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          enabled: boolean | null
          endpoint_key: string | null
          id: string | null
          last_triggered_at: string | null
          name: string | null
          secret_key: string | null
          trigger_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          endpoint_key?: string | null
          id?: string | null
          last_triggered_at?: string | null
          name?: string | null
          secret_key?: never
          trigger_count?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          enabled?: boolean | null
          endpoint_key?: string | null
          id?: string | null
          last_triggered_at?: string | null
          name?: string | null
          secret_key?: never
          trigger_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "operator" | "logistics"
      automation_action_type:
        | "create_work_order"
        | "update_work_order_status"
        | "update_item_status"
        | "log_activity"
        | "trigger_outgoing_webhook"
      operator_initials: "MB" | "HL" | "AB" | "EV"
      product_type: "SDM_ECO" | "SENSOR" | "MLA" | "HMI" | "TRANSMITTER"
      step_status: "pending" | "in_progress" | "completed" | "skipped"
      work_order_status:
        | "planned"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
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
    Enums: {
      app_role: ["admin", "supervisor", "operator", "logistics"],
      automation_action_type: [
        "create_work_order",
        "update_work_order_status",
        "update_item_status",
        "log_activity",
        "trigger_outgoing_webhook",
      ],
      operator_initials: ["MB", "HL", "AB", "EV"],
      product_type: ["SDM_ECO", "SENSOR", "MLA", "HMI", "TRANSMITTER"],
      step_status: ["pending", "in_progress", "completed", "skipped"],
      work_order_status: [
        "planned",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
