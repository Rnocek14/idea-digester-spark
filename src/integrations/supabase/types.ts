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
      activity_log: {
        Row: {
          action: string
          actor_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          message: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          message?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          message?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auto_publish_rules: {
        Row: {
          action: string
          category: string | null
          created_at: string
          enabled: boolean
          id: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_publish_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_queue: {
        Row: {
          author: string | null
          category: string | null
          content: string
          content_facebook: string | null
          content_instagram: string | null
          content_lg_base: string | null
          content_newsletter: string | null
          content_website: string | null
          content_x: string | null
          created_at: string
          id: string
          image_url: string | null
          last_newsletter_id: string | null
          metadata: Json | null
          original_url: string | null
          publish_date: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          safety_level: string | null
          safety_reason: string | null
          safety_tags: Json | null
          source_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          voice_generated_at: string | null
          voice_version: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          content: string
          content_facebook?: string | null
          content_instagram?: string | null
          content_lg_base?: string | null
          content_newsletter?: string | null
          content_website?: string | null
          content_x?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          last_newsletter_id?: string | null
          metadata?: Json | null
          original_url?: string | null
          publish_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_level?: string | null
          safety_reason?: string | null
          safety_tags?: Json | null
          source_id?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          voice_generated_at?: string | null
          voice_version?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: string
          content_facebook?: string | null
          content_instagram?: string | null
          content_lg_base?: string | null
          content_newsletter?: string | null
          content_website?: string | null
          content_x?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          last_newsletter_id?: string | null
          metadata?: Json | null
          original_url?: string | null
          publish_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_level?: string | null
          safety_reason?: string | null
          safety_tags?: Json | null
          source_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          voice_generated_at?: string | null
          voice_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_queue_last_newsletter_id_fkey"
            columns: ["last_newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_queue_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      content_targets: {
        Row: {
          channel_id: string
          content_id: string
          created_at: string
          error_message: string | null
          external_post_id: string | null
          id: string
          posted_at: string | null
          scheduled_for: string | null
          status: string
        }
        Insert: {
          channel_id: string
          content_id: string
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string
        }
        Update: {
          channel_id?: string
          content_id?: string
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_targets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "distribution_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_targets_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          type?: string
        }
        Relationships: []
      }
      newsletter_clicks: {
        Row: {
          clicked_at: string
          created_at: string
          id: string
          ip_address: string | null
          link_url: string
          newsletter_id: string
          subscriber_email: string | null
          subscriber_id: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          link_url: string
          newsletter_id: string
          subscriber_email?: string | null
          subscriber_id?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          link_url?: string
          newsletter_id?: string
          subscriber_email?: string | null
          subscriber_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_clicks_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_clicks_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_opens: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          newsletter_id: string
          opened_at: string
          subscriber_email: string | null
          subscriber_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          newsletter_id: string
          opened_at?: string
          subscriber_email?: string | null
          subscriber_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          newsletter_id?: string
          opened_at?: string
          subscriber_email?: string | null
          subscriber_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_opens_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_opens_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletters: {
        Row: {
          auto_send_enabled: boolean | null
          created_at: string
          edition_date: string
          error_message: string | null
          html_body: string
          id: string
          metadata: Json | null
          preheader: string | null
          sent_at: string | null
          status: string
          story_count: number
          story_ids: string[]
          subject: string
          text_body: string
          updated_at: string
        }
        Insert: {
          auto_send_enabled?: boolean | null
          created_at?: string
          edition_date: string
          error_message?: string | null
          html_body: string
          id?: string
          metadata?: Json | null
          preheader?: string | null
          sent_at?: string | null
          status?: string
          story_count?: number
          story_ids?: string[]
          subject: string
          text_body: string
          updated_at?: string
        }
        Update: {
          auto_send_enabled?: boolean | null
          created_at?: string
          edition_date?: string
          error_message?: string | null
          html_body?: string
          id?: string
          metadata?: Json | null
          preheader?: string | null
          sent_at?: string | null
          status?: string
          story_count?: number
          story_ids?: string[]
          subject?: string
          text_body?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_queue: {
        Row: {
          created_at: string
          error_message: string | null
          external_post_id: string | null
          id: string
          image_url: string | null
          metadata: Json | null
          platform: string
          post_text: string
          scheduled_for: string
          sent_at: string | null
          status: string
          story_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          platform: string
          post_text: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          story_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          platform?: string
          post_text?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_queue_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          category: string | null
          created_at: string
          fetch_frequency_minutes: number | null
          id: string
          last_fetched_at: string | null
          metadata: Json | null
          name: string
          status: string
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          fetch_frequency_minutes?: number | null
          id?: string
          last_fetched_at?: string | null
          metadata?: Json | null
          name: string
          status?: string
          type: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          fetch_frequency_minutes?: number | null
          id?: string
          last_fetched_at?: string | null
          metadata?: Json | null
          name?: string
          status?: string
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          ad_slots_remaining: number | null
          business_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          end_date: string | null
          id: string
          logo_url: string | null
          metadata: Json | null
          notes: string | null
          phone: string | null
          start_date: string | null
          status: string
          tier: string
          updated_at: string
          website: string | null
        }
        Insert: {
          ad_slots_remaining?: number | null
          business_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          tier?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          ad_slots_remaining?: number | null
          business_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          notes?: string | null
          phone?: string | null
          start_date?: string | null
          status?: string
          tier?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          city_id: string | null
          created_at: string
          email: string
          engagement_score: number | null
          id: string
          last_clicked_at: string | null
          last_opened_at: string | null
          metadata: Json | null
          source: string | null
          status: string
          subscribed_at: string
          tags: string[] | null
          unsubscribe_reason: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          email: string
          engagement_score?: number | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          metadata?: Json | null
          source?: string | null
          status?: string
          subscribed_at?: string
          tags?: string[] | null
          unsubscribe_reason?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          email?: string
          engagement_score?: number | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          metadata?: Json | null
          source?: string | null
          status?: string
          subscribed_at?: string
          tags?: string[] | null
          unsubscribe_reason?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
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
      [_ in never]: never
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
