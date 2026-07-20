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
      campaigns: {
        Row: {
          avg_cross_sell_value: number | null
          avg_product_value: number | null
          avg_upsell_value: number | null
          budget: number
          campaign_name: string
          client_id: string | null
          client_name_legacy: string | null
          created_at: string
          daily_budget: number
          days: number
          end_date: string | null
          id: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          results: Json
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          avg_cross_sell_value?: number | null
          avg_product_value?: number | null
          avg_upsell_value?: number | null
          budget?: number
          campaign_name: string
          client_id?: string | null
          client_name_legacy?: string | null
          created_at?: string
          daily_budget?: number
          days?: number
          end_date?: string | null
          id?: string
          objective?: Database["public"]["Enums"]["campaign_objective"]
          results?: Json
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          avg_cross_sell_value?: number | null
          avg_product_value?: number | null
          avg_upsell_value?: number | null
          budget?: number
          campaign_name?: string
          client_id?: string | null
          client_name_legacy?: string | null
          created_at?: string
          daily_budget?: number
          days?: number
          end_date?: string | null
          id?: string
          objective?: Database["public"]["Enums"]["campaign_objective"]
          results?: Json
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          invited_by: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_wallets: {
        Row: {
          balance: number
          client_id: string
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_wallets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          segment: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          segment?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          segment?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estimation_settings: {
        Row: {
          checkout_initiation_rate: number
          created_at: string
          cta_view_rate: number
          offer_view_rate: number
          recurring_customer_rate: number
          remarketing_reach_rate: number
          updated_at: string
          user_id: string
          views_share_of_impressions: number
        }
        Insert: {
          checkout_initiation_rate?: number
          created_at?: string
          cta_view_rate?: number
          offer_view_rate?: number
          recurring_customer_rate?: number
          remarketing_reach_rate?: number
          updated_at?: string
          user_id: string
          views_share_of_impressions?: number
        }
        Update: {
          checkout_initiation_rate?: number
          created_at?: string
          cta_view_rate?: number
          offer_view_rate?: number
          recurring_customer_rate?: number
          remarketing_reach_rate?: number
          updated_at?: string
          user_id?: string
          views_share_of_impressions?: number
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          expires_at: string | null
          external_payment_id: string | null
          id: string
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qrcode: string | null
          pix_txid: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          expires_at?: string | null
          external_payment_id?: string | null
          id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qrcode?: string | null
          pix_txid?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          expires_at?: string | null
          external_payment_id?: string | null
          id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qrcode?: string | null
          pix_txid?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_metrics_history: {
        Row: {
          comments: number
          created_at: string
          engagement_rate: number
          followers: number
          id: string
          impressions: number
          likes: number
          notes: string | null
          reach: number
          recorded_at: string
          shares: number
          social_profile_id: string
          user_id: string
          views: number
        }
        Insert: {
          comments?: number
          created_at?: string
          engagement_rate?: number
          followers?: number
          id?: string
          impressions?: number
          likes?: number
          notes?: string | null
          reach?: number
          recorded_at?: string
          shares?: number
          social_profile_id: string
          user_id: string
          views?: number
        }
        Update: {
          comments?: number
          created_at?: string
          engagement_rate?: number
          followers?: number
          id?: string
          impressions?: number
          likes?: number
          notes?: string | null
          reach?: number
          recorded_at?: string
          shares?: number
          social_profile_id?: string
          user_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_metrics_history_social_profile_id_fkey"
            columns: ["social_profile_id"]
            isOneToOne: false
            referencedRelation: "social_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          avatar_url: string | null
          client_id: string
          created_at: string
          current_followers: number
          id: string
          is_active: boolean
          platform: Database["public"]["Enums"]["social_platform"]
          profile_name: string
          profile_url: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          client_id: string
          created_at?: string
          current_followers?: number
          id?: string
          is_active?: boolean
          platform: Database["public"]["Enums"]["social_platform"]
          profile_name: string
          profile_url?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string
          created_at?: string
          current_followers?: number
          id?: string
          is_active?: boolean
          platform?: Database["public"]["Enums"]["social_platform"]
          profile_name?: string
          profile_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          plan: Database["public"]["Enums"]["app_plan"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          plan?: Database["public"]["Enums"]["app_plan"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          plan?: Database["public"]["Enums"]["app_plan"]
          status?: string
          updated_at?: string
          user_id?: string
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
      wallet_ledger: {
        Row: {
          amount: number
          balance_after: number
          campaign_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id: string
          note: string | null
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          campaign_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id?: string
          note?: string | null
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          campaign_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          entry_type?: Database["public"]["Enums"]["wallet_entry_type"]
          id?: string
          note?: string | null
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "client_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          avg_cross_sell_value: number | null
          avg_product_value: number | null
          avg_upsell_value: number | null
          budget: number
          campaign_name: string
          client_id: string | null
          client_name_legacy: string | null
          created_at: string
          daily_budget: number
          days: number
          end_date: string | null
          id: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          results: Json
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          user_id: string
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          avg_cross_sell_value: number | null
          avg_product_value: number | null
          avg_upsell_value: number | null
          budget: number
          campaign_name: string
          client_id: string | null
          client_name_legacy: string | null
          created_at: string
          daily_budget: number
          days: number
          end_date: string | null
          id: string
          objective: Database["public"]["Enums"]["campaign_objective"]
          results: Json
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          user_id: string
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "campaigns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_client_id: { Args: never; Returns: string }
      fund_campaign: {
        Args: { _campaign_id: string }
        Returns: {
          amount: number
          balance_after: number
          campaign_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id: string
          note: string | null
          user_id: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_campaign: {
        Args: { _campaign_id: string; _cancel?: boolean; _note?: string }
        Returns: {
          amount: number
          balance_after: number
          campaign_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id: string
          note: string | null
          user_id: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_adjust: {
        Args: { _amount: number; _client_id: string; _note?: string }
        Returns: {
          amount: number
          balance_after: number
          campaign_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id: string
          note: string | null
          user_id: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      wallet_credit: {
        Args: { _amount: number; _client_id: string; _note?: string }
        Returns: {
          amount: number
          balance_after: number
          campaign_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id: string
          note: string | null
          user_id: string
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_plan: "free" | "pro" | "agency"
      app_role: "admin" | "user" | "client"
      campaign_objective:
        | "views"
        | "engagement"
        | "traffic"
        | "conversion"
        | "sales"
        | "awareness"
      campaign_status:
        | "draft"
        | "running"
        | "completed"
        | "pending_payment"
        | "funded"
        | "active"
        | "cancelled"
        | "refunded"
      payment_status: "pending" | "paid" | "expired" | "cancelled"
      social_platform: "instagram" | "tiktok" | "youtube" | "facebook"
      wallet_entry_type: "credit" | "debit" | "refund" | "adjustment"
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
      app_plan: ["free", "pro", "agency"],
      app_role: ["admin", "user", "client"],
      campaign_objective: [
        "views",
        "engagement",
        "traffic",
        "conversion",
        "sales",
        "awareness",
      ],
      campaign_status: [
        "draft",
        "running",
        "completed",
        "pending_payment",
        "funded",
        "active",
        "cancelled",
        "refunded",
      ],
      payment_status: ["pending", "paid", "expired", "cancelled"],
      social_platform: ["instagram", "tiktok", "youtube", "facebook"],
      wallet_entry_type: ["credit", "debit", "refund", "adjustment"],
    },
  },
} as const
