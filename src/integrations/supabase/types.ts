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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          created_at: string
          display_label: string | null
          id: string
          name: string
          notes: string | null
          short_code: string | null
        }
        Insert: {
          created_at?: string
          display_label?: string | null
          id?: string
          name: string
          notes?: string | null
          short_code?: string | null
        }
        Update: {
          created_at?: string
          display_label?: string | null
          id?: string
          name?: string
          notes?: string | null
          short_code?: string | null
        }
        Relationships: []
      }
      email_imports: {
        Row: {
          created_at: string
          detected_rfq: string | null
          detected_supplier: string | null
          error_message: string | null
          from_address: string | null
          from_name: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          parsed_payload: Json | null
          processed_at: string | null
          received_at: string | null
          snippet: string | null
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          detected_rfq?: string | null
          detected_supplier?: string | null
          error_message?: string | null
          from_address?: string | null
          from_name?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          parsed_payload?: Json | null
          processed_at?: string | null
          received_at?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          detected_rfq?: string | null
          detected_supplier?: string | null
          error_message?: string | null
          from_address?: string | null
          from_name?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          parsed_payload?: Json | null
          processed_at?: string | null
          received_at?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          category: string
          class: string | null
          constructive: string | null
          created_at: string
          description: string | null
          dn: string | null
          face: string | null
          id: string
          item_code: string | null
          material: string | null
          material_type: string | null
          notes: string | null
          pipe_end: string | null
          product: string | null
          qty: number | null
          rfq_id: string
          sch_thk: string | null
          source: string
          specs: Json
          unit_weight: number | null
          updated_at: string
        }
        Insert: {
          category: string
          class?: string | null
          constructive?: string | null
          created_at?: string
          description?: string | null
          dn?: string | null
          face?: string | null
          id?: string
          item_code?: string | null
          material?: string | null
          material_type?: string | null
          notes?: string | null
          pipe_end?: string | null
          product?: string | null
          qty?: number | null
          rfq_id: string
          sch_thk?: string | null
          source?: string
          specs?: Json
          unit_weight?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          class?: string | null
          constructive?: string | null
          created_at?: string
          description?: string | null
          dn?: string | null
          face?: string | null
          id?: string
          item_code?: string | null
          material?: string | null
          material_type?: string | null
          notes?: string | null
          pipe_end?: string | null
          product?: string | null
          qty?: number | null
          rfq_id?: string
          sch_thk?: string | null
          source?: string
          specs?: Json
          unit_weight?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          client_name: string | null
          created_at: string
          id: string
          lote: string | null
          notes: string | null
          op: string | null
          pi: string | null
          quote_date: string | null
          rfq_number: string
          status: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          id?: string
          lote?: string | null
          notes?: string | null
          op?: string | null
          pi?: string | null
          quote_date?: string | null
          rfq_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          id?: string
          lote?: string | null
          notes?: string | null
          op?: string | null
          pi?: string | null
          quote_date?: string | null
          rfq_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_prices: {
        Row: {
          created_at: string
          currency: string
          email_message_id: string | null
          id: string
          price: number | null
          quote_item_id: string
          received_at: string | null
          source: string
          supplier_name: string
        }
        Insert: {
          created_at?: string
          currency?: string
          email_message_id?: string | null
          id?: string
          price?: number | null
          quote_item_id: string
          received_at?: string | null
          source?: string
          supplier_name: string
        }
        Update: {
          created_at?: string
          currency?: string
          email_message_id?: string | null
          id?: string
          price?: number | null
          quote_item_id?: string
          received_at?: string | null
          source?: string
          supplier_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_prices_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_prices_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items_best"
            referencedColumns: ["quote_item_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email_domains: string[]
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email_domains?: string[]
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email_domains?: string[]
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      quote_items_best: {
        Row: {
          best_price: number | null
          best_price_date: string | null
          best_supplier: string | null
          quote_item_id: string | null
          quotes_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "member"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "member"],
    },
  },
} as const
