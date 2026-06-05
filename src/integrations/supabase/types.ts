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
      ad_placements: {
        Row: {
          business_id: string | null
          created_at: string | null
          creative_url: string | null
          end_date: string
          id: string
          label: string | null
          metadata: Json | null
          notes: string | null
          package_type: string | null
          slot_id: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          creative_url?: string | null
          end_date: string
          id?: string
          label?: string | null
          metadata?: Json | null
          notes?: string | null
          package_type?: string | null
          slot_id?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          creative_url?: string | null
          end_date?: string
          id?: string
          label?: string | null
          metadata?: Json | null
          notes?: string | null
          package_type?: string | null
          slot_id?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_placements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_placements_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "ad_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_slots: {
        Row: {
          channel: string
          description: string | null
          dimensions: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          price_monthly: number | null
        }
        Insert: {
          channel: string
          description?: string | null
          dimensions?: string | null
          id: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          price_monthly?: number | null
        }
        Update: {
          channel?: string
          description?: string | null
          dimensions?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          price_monthly?: number | null
        }
        Relationships: []
      }
      advertiser_leads: {
        Row: {
          business_id: string | null
          business_name: string
          business_profile_id: string | null
          contact_name: string
          created_at: string
          email: string
          id: string
          notes: string | null
          phone: string | null
          source: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          business_id?: string | null
          business_name: string
          business_profile_id?: string | null
          contact_name: string
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          business_id?: string | null
          business_name?: string
          business_profile_id?: string | null
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertiser_leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertiser_leads_business_profile_id_fkey"
            columns: ["business_profile_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_deals: {
        Row: {
          business_id: string | null
          created_at: string | null
          description: string | null
          discount_code: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_code?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_code?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_deals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_publish_rules: {
        Row: {
          action: string
          category: string | null
          created_at: string
          enabled: boolean
          id: string
          requires_hyperlocal: boolean | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          requires_hyperlocal?: boolean | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          category?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          requires_hyperlocal?: boolean | null
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
      business_profiles: {
        Row: {
          address: string | null
          business_type: string | null
          categories: string[] | null
          category: string | null
          city: string | null
          created_at: string | null
          description: string | null
          email: string | null
          external_payload: Json | null
          geo_tier: number | null
          google_place_id: string | null
          id: string
          import_source: string | null
          is_featured: boolean | null
          is_hidden: boolean | null
          last_synced_at: string | null
          logo_url: string | null
          merged_into_id: string | null
          metadata: Json | null
          name: string
          normalized_name: string | null
          phone: string | null
          source_confidence: string | null
          status: string | null
          testimonial_quote: string | null
          updated_at: string | null
          website: string | null
          zillow_rating: number | null
          zillow_review_count: number | null
          zillow_url: string | null
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          categories?: string[] | null
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          external_payload?: Json | null
          geo_tier?: number | null
          google_place_id?: string | null
          id?: string
          import_source?: string | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          last_synced_at?: string | null
          logo_url?: string | null
          merged_into_id?: string | null
          metadata?: Json | null
          name: string
          normalized_name?: string | null
          phone?: string | null
          source_confidence?: string | null
          status?: string | null
          testimonial_quote?: string | null
          updated_at?: string | null
          website?: string | null
          zillow_rating?: number | null
          zillow_review_count?: number | null
          zillow_url?: string | null
        }
        Update: {
          address?: string | null
          business_type?: string | null
          categories?: string[] | null
          category?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          external_payload?: Json | null
          geo_tier?: number | null
          google_place_id?: string | null
          id?: string
          import_source?: string | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          last_synced_at?: string | null
          logo_url?: string | null
          merged_into_id?: string | null
          metadata?: Json | null
          name?: string
          normalized_name?: string | null
          phone?: string | null
          source_confidence?: string | null
          status?: string | null
          testimonial_quote?: string | null
          updated_at?: string | null
          website?: string | null
          zillow_rating?: number | null
          zillow_review_count?: number | null
          zillow_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          author_id: string | null
          body_md: string
          category: string
          created_at: string
          excerpt: string | null
          hero_image_url: string | null
          historical_year: number | null
          id: string
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_md: string
          category: string
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          historical_year?: number | null
          id?: string
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_md?: string
          category?: string
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          historical_year?: number | null
          id?: string
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "community_authors"
            referencedColumns: ["id"]
          },
        ]
      }
      community_submissions: {
        Row: {
          body: string
          category: string | null
          created_at: string
          historical_year: number | null
          honeypot: string | null
          id: string
          kind: string
          photo_url: string | null
          published_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shore_path_stop_id: string | null
          status: string
          subject_name: string | null
          subject_type: string | null
          submitter_email: string | null
          submitter_ip: unknown
          submitter_name: string | null
          submitter_town: string | null
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          historical_year?: number | null
          honeypot?: string | null
          id?: string
          kind: string
          photo_url?: string | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shore_path_stop_id?: string | null
          status?: string
          subject_name?: string | null
          subject_type?: string | null
          submitter_email?: string | null
          submitter_ip?: unknown
          submitter_name?: string | null
          submitter_town?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          historical_year?: number | null
          honeypot?: string | null
          id?: string
          kind?: string
          photo_url?: string | null
          published_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shore_path_stop_id?: string | null
          status?: string
          subject_name?: string | null
          subject_type?: string | null
          submitter_email?: string | null
          submitter_ip?: unknown
          submitter_name?: string | null
          submitter_town?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_submissions_shore_path_stop_id_fkey"
            columns: ["shore_path_stop_id"]
            isOneToOne: false
            referencedRelation: "shore_path_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      community_venues: {
        Row: {
          aliases: string[]
          business_profile_id: string | null
          canonical_name: string
          collection: string
          created_at: string
          display_rank: number | null
          editor_note: string | null
          id: string
          is_editorial_pick: boolean
          neighborhood: string | null
          short_descriptor: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          business_profile_id?: string | null
          canonical_name: string
          collection: string
          created_at?: string
          display_rank?: number | null
          editor_note?: string | null
          id?: string
          is_editorial_pick?: boolean
          neighborhood?: string | null
          short_descriptor?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          business_profile_id?: string | null
          canonical_name?: string
          collection?: string
          created_at?: string
          display_rank?: number | null
          editor_note?: string | null
          id?: string
          is_editorial_pick?: boolean
          neighborhood?: string | null
          short_descriptor?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_venues_business_profile_id_fkey"
            columns: ["business_profile_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
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
          data_snapshot_id: string | null
          decision_path: string | null
          editorial_pick_reason: string | null
          event_date: string | null
          event_time: string | null
          featured_in_later: boolean
          featured_rank: number | null
          featured_until: string | null
          geo_label: string | null
          geo_tier: number | null
          hold_reason: string | null
          id: string
          image_source: string | null
          image_url: string | null
          is_breaking: boolean | null
          is_sponsored: boolean | null
          last_newsletter_id: string | null
          last_updated_at: string | null
          metadata: Json | null
          normalized_url: string | null
          original_url: string | null
          performer: string | null
          pick_tag: string[]
          priority_score: number | null
          publish_date: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          safety_level: string | null
          safety_reason: string | null
          safety_tags: Json | null
          source_id: string | null
          source_type: string | null
          sponsor_id: string | null
          status: string
          submitted_by_email: string | null
          submitter_name: string | null
          summary: string | null
          title: string
          trust_labels: Json | null
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
          data_snapshot_id?: string | null
          decision_path?: string | null
          editorial_pick_reason?: string | null
          event_date?: string | null
          event_time?: string | null
          featured_in_later?: boolean
          featured_rank?: number | null
          featured_until?: string | null
          geo_label?: string | null
          geo_tier?: number | null
          hold_reason?: string | null
          id?: string
          image_source?: string | null
          image_url?: string | null
          is_breaking?: boolean | null
          is_sponsored?: boolean | null
          last_newsletter_id?: string | null
          last_updated_at?: string | null
          metadata?: Json | null
          normalized_url?: string | null
          original_url?: string | null
          performer?: string | null
          pick_tag?: string[]
          priority_score?: number | null
          publish_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_level?: string | null
          safety_reason?: string | null
          safety_tags?: Json | null
          source_id?: string | null
          source_type?: string | null
          sponsor_id?: string | null
          status?: string
          submitted_by_email?: string | null
          submitter_name?: string | null
          summary?: string | null
          title: string
          trust_labels?: Json | null
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
          data_snapshot_id?: string | null
          decision_path?: string | null
          editorial_pick_reason?: string | null
          event_date?: string | null
          event_time?: string | null
          featured_in_later?: boolean
          featured_rank?: number | null
          featured_until?: string | null
          geo_label?: string | null
          geo_tier?: number | null
          hold_reason?: string | null
          id?: string
          image_source?: string | null
          image_url?: string | null
          is_breaking?: boolean | null
          is_sponsored?: boolean | null
          last_newsletter_id?: string | null
          last_updated_at?: string | null
          metadata?: Json | null
          normalized_url?: string | null
          original_url?: string | null
          performer?: string | null
          pick_tag?: string[]
          priority_score?: number | null
          publish_date?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_level?: string | null
          safety_reason?: string | null
          safety_tags?: Json | null
          source_id?: string | null
          source_type?: string | null
          sponsor_id?: string | null
          status?: string
          submitted_by_email?: string | null
          submitter_name?: string | null
          summary?: string | null
          title?: string
          trust_labels?: Json | null
          updated_at?: string
          voice_generated_at?: string | null
          voice_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_queue_data_snapshot_id_fkey"
            columns: ["data_snapshot_id"]
            isOneToOne: false
            referencedRelation: "data_snapshots"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "content_queue_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
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
            referencedRelation: "canary_stuck_stories"
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
      data_snapshots: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          query_description: string
          result_summary: Json
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          query_description: string
          result_summary: Json
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          query_description?: string
          result_summary?: Json
        }
        Relationships: []
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
      employer_access_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employer_email_preferences: {
        Row: {
          created_at: string
          email: string
          expiry_reminders: boolean
          id: string
          updated_at: string
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expiry_reminders?: boolean
          id?: string
          updated_at?: string
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expiry_reminders?: boolean
          id?: string
          updated_at?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      engagement_opportunities: {
        Row: {
          author_display_name: string | null
          author_profile_url: string | null
          author_username: string | null
          created_at: string
          fetched_at: string
          hashtags: string[] | null
          id: string
          metadata: Json | null
          notes: string | null
          opportunity_type: string
          platform: string
          priority_score: number | null
          status: string
          tweet_created_at: string | null
          tweet_id: string | null
          tweet_text: string | null
          tweet_url: string | null
          updated_at: string
        }
        Insert: {
          author_display_name?: string | null
          author_profile_url?: string | null
          author_username?: string | null
          created_at?: string
          fetched_at?: string
          hashtags?: string[] | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          opportunity_type: string
          platform?: string
          priority_score?: number | null
          status?: string
          tweet_created_at?: string | null
          tweet_id?: string | null
          tweet_text?: string | null
          tweet_url?: string | null
          updated_at?: string
        }
        Update: {
          author_display_name?: string | null
          author_profile_url?: string | null
          author_username?: string | null
          created_at?: string
          fetched_at?: string
          hashtags?: string[] | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          opportunity_type?: string
          platform?: string
          priority_score?: number | null
          status?: string
          tweet_created_at?: string | null
          tweet_id?: string | null
          tweet_text?: string | null
          tweet_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      evergreen_content: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          priority: number
          season: string | null
          title: string
          updated_at: string
          use_count: number
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          priority?: number
          season?: string | null
          title: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          priority?: number
          season?: string | null
          title?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: []
      }
      fish_fry_history: {
        Row: {
          all_you_can_eat: boolean | null
          change_type: string
          changed_by: string | null
          created_at: string
          days: string[] | null
          deal_id: string | null
          evidence_snippet: string | null
          evidence_url: string | null
          fish_type: string | null
          id: string
          price: string | null
          restaurant_id: string | null
          sides: string | null
        }
        Insert: {
          all_you_can_eat?: boolean | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          days?: string[] | null
          deal_id?: string | null
          evidence_snippet?: string | null
          evidence_url?: string | null
          fish_type?: string | null
          id?: string
          price?: string | null
          restaurant_id?: string | null
          sides?: string | null
        }
        Update: {
          all_you_can_eat?: boolean | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          days?: string[] | null
          deal_id?: string | null
          evidence_snippet?: string | null
          evidence_url?: string | null
          fish_type?: string | null
          id?: string
          price?: string | null
          restaurant_id?: string | null
          sides?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fish_fry_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "restaurant_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fish_fry_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      fish_fry_submissions: {
        Row: {
          created_at: string
          day_served: string | null
          description: string | null
          fish_type: string | null
          happy_hour_days: string[] | null
          happy_hour_deals: string | null
          happy_hour_end: string | null
          happy_hour_start: string | null
          id: string
          is_all_you_can_eat: boolean | null
          is_verified: boolean | null
          moderated_at: string | null
          moderated_by: string | null
          moderation_notes: string | null
          price: string | null
          proof_image_url: string | null
          proof_url: string | null
          restaurant_id: string | null
          restaurant_name: string
          restaurant_slug: string | null
          sides: string | null
          source: string | null
          status: string
          submitter_email: string | null
          submitter_name: string | null
          updated_at: string
          weekly_specials: Json | null
        }
        Insert: {
          created_at?: string
          day_served?: string | null
          description?: string | null
          fish_type?: string | null
          happy_hour_days?: string[] | null
          happy_hour_deals?: string | null
          happy_hour_end?: string | null
          happy_hour_start?: string | null
          id?: string
          is_all_you_can_eat?: boolean | null
          is_verified?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          price?: string | null
          proof_image_url?: string | null
          proof_url?: string | null
          restaurant_id?: string | null
          restaurant_name: string
          restaurant_slug?: string | null
          sides?: string | null
          source?: string | null
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
          updated_at?: string
          weekly_specials?: Json | null
        }
        Update: {
          created_at?: string
          day_served?: string | null
          description?: string | null
          fish_type?: string | null
          happy_hour_days?: string[] | null
          happy_hour_deals?: string | null
          happy_hour_end?: string | null
          happy_hour_start?: string | null
          id?: string
          is_all_you_can_eat?: boolean | null
          is_verified?: boolean | null
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_notes?: string | null
          price?: string | null
          proof_image_url?: string | null
          proof_url?: string | null
          restaurant_id?: string | null
          restaurant_name?: string
          restaurant_slug?: string | null
          sides?: string | null
          source?: string | null
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
          updated_at?: string
          weekly_specials?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fish_fry_submissions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          created_at: string
          id: string
          incident_id: string
          is_verified: boolean
          source: string
          source_label: string | null
          story_id: string | null
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          incident_id: string
          is_verified?: boolean
          source: string
          source_label?: string | null
          story_id?: string | null
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          incident_id?: string
          is_verified?: boolean
          source?: string
          source_label?: string | null
          story_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "canary_stuck_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          external_id: string | null
          id: string
          incident_type: string
          location: string | null
          priority_score: number | null
          resolution_reason: string | null
          resolved_at: string | null
          slug: string
          source: string | null
          source_story_id: string | null
          started_at: string
          status: string
          sub_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          external_id?: string | null
          id?: string
          incident_type: string
          location?: string | null
          priority_score?: number | null
          resolution_reason?: string | null
          resolved_at?: string | null
          slug: string
          source?: string | null
          source_story_id?: string | null
          started_at?: string
          status?: string
          sub_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          external_id?: string | null
          id?: string
          incident_type?: string
          location?: string | null
          priority_score?: number | null
          resolution_reason?: string | null
          resolved_at?: string | null
          slug?: string
          source?: string | null
          source_story_id?: string | null
          started_at?: string
          status?: string
          sub_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_source_story_id_fkey"
            columns: ["source_story_id"]
            isOneToOne: false
            referencedRelation: "canary_stuck_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_source_story_id_fkey"
            columns: ["source_story_id"]
            isOneToOne: false
            referencedRelation: "content_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      job_clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_address: string | null
          job_id: string
          newsletter_id: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          job_id: string
          newsletter_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          job_id?: string
          newsletter_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_clicks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_clicks_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          amount_cents: number | null
          apply_url: string | null
          business_id: string | null
          business_name: string
          category: string
          contact_email: string
          contact_phone: string | null
          created_at: string | null
          description: string
          expires_at: string
          id: string
          is_featured: boolean | null
          job_type: string
          location_text: string | null
          paid_at: string | null
          pay_display: string | null
          pay_max: number | null
          pay_min: number | null
          pay_type: string | null
          payment_status: string | null
          pricing_tier: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          apply_url?: string | null
          business_id?: string | null
          business_name: string
          category: string
          contact_email: string
          contact_phone?: string | null
          created_at?: string | null
          description: string
          expires_at: string
          id?: string
          is_featured?: boolean | null
          job_type: string
          location_text?: string | null
          paid_at?: string | null
          pay_display?: string | null
          pay_max?: number | null
          pay_min?: number | null
          pay_type?: string | null
          payment_status?: string | null
          pricing_tier?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          apply_url?: string | null
          business_id?: string | null
          business_name?: string
          category?: string
          contact_email?: string
          contact_phone?: string | null
          created_at?: string | null
          description?: string
          expires_at?: string
          id?: string
          is_featured?: boolean | null
          job_type?: string
          location_text?: string | null
          paid_at?: string | null
          pay_display?: string | null
          pay_max?: number | null
          pay_min?: number | null
          pay_type?: string | null
          payment_status?: string | null
          pricing_tier?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_clicks: {
        Row: {
          ad_placement_id: string | null
          business_id: string | null
          click_source: string | null
          clicked_at: string
          created_at: string
          id: string
          ip_address: string | null
          link_url: string
          newsletter_id: string | null
          subscriber_email: string | null
          subscriber_id: string | null
          user_agent: string | null
        }
        Insert: {
          ad_placement_id?: string | null
          business_id?: string | null
          click_source?: string | null
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          link_url: string
          newsletter_id?: string | null
          subscriber_email?: string | null
          subscriber_id?: string | null
          user_agent?: string | null
        }
        Update: {
          ad_placement_id?: string | null
          business_id?: string | null
          click_source?: string | null
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          link_url?: string
          newsletter_id?: string | null
          subscriber_email?: string | null
          subscriber_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_clicks_ad_placement_id_fkey"
            columns: ["ad_placement_id"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_clicks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
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
          newsletter_type: string | null
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
          newsletter_type?: string | null
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
          newsletter_type?: string | null
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
          generated_image_url: string | null
          id: string
          image_url: string | null
          is_sponsored: boolean | null
          metadata: Json | null
          platform: string
          post_text: string
          scheduled_for: string
          sent_at: string | null
          sponsor_id: string | null
          status: string
          story_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          generated_image_url?: string | null
          id?: string
          image_url?: string | null
          is_sponsored?: boolean | null
          metadata?: Json | null
          platform: string
          post_text: string
          scheduled_for: string
          sent_at?: string | null
          sponsor_id?: string | null
          status?: string
          story_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_post_id?: string | null
          generated_image_url?: string | null
          id?: string
          image_url?: string | null
          is_sponsored?: boolean | null
          metadata?: Json | null
          platform?: string
          post_text?: string
          scheduled_for?: string
          sent_at?: string | null
          sponsor_id?: string | null
          status?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_queue_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_queue_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "canary_stuck_stories"
            referencedColumns: ["id"]
          },
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
      real_estate_metrics: {
        Row: {
          active_listings: number
          fetched_at: string | null
          id: string
          median_list_price: number | null
          median_price: number
          new_listings: number | null
          source: string | null
          updated_at: string | null
          yoy_change: number
          zip_code: string
        }
        Insert: {
          active_listings: number
          fetched_at?: string | null
          id?: string
          median_list_price?: number | null
          median_price: number
          new_listings?: number | null
          source?: string | null
          updated_at?: string | null
          yoy_change: number
          zip_code?: string
        }
        Update: {
          active_listings?: number
          fetched_at?: string | null
          id?: string
          median_list_price?: number | null
          median_price?: number
          new_listings?: number | null
          source?: string | null
          updated_at?: string | null
          yoy_change?: number
          zip_code?: string
        }
        Relationships: []
      }
      restaurant_deals: {
        Row: {
          all_you_can_eat: boolean | null
          confidence_score: number | null
          created_at: string | null
          days: string[] | null
          deal_hash: string | null
          deal_type: string
          description: string | null
          drink_deals: string[] | null
          end_minutes: number | null
          end_time: string | null
          evidence_snippet: string | null
          evidence_url: string | null
          fish_type: string | null
          food_deals: string[] | null
          id: string
          last_confirmed_at: string | null
          last_seen_at: string | null
          name: string
          price: string | null
          restaurant_id: string | null
          sides: string | null
          source_type: string | null
          start_minutes: number | null
          start_time: string | null
          submitted_by: string | null
          updated_at: string | null
          valid_to: string | null
          verification_method: string | null
          verification_status: string | null
        }
        Insert: {
          all_you_can_eat?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          days?: string[] | null
          deal_hash?: string | null
          deal_type: string
          description?: string | null
          drink_deals?: string[] | null
          end_minutes?: number | null
          end_time?: string | null
          evidence_snippet?: string | null
          evidence_url?: string | null
          fish_type?: string | null
          food_deals?: string[] | null
          id?: string
          last_confirmed_at?: string | null
          last_seen_at?: string | null
          name: string
          price?: string | null
          restaurant_id?: string | null
          sides?: string | null
          source_type?: string | null
          start_minutes?: number | null
          start_time?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          valid_to?: string | null
          verification_method?: string | null
          verification_status?: string | null
        }
        Update: {
          all_you_can_eat?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          days?: string[] | null
          deal_hash?: string | null
          deal_type?: string
          description?: string | null
          drink_deals?: string[] | null
          end_minutes?: number | null
          end_time?: string | null
          evidence_snippet?: string | null
          evidence_url?: string | null
          fish_type?: string | null
          food_deals?: string[] | null
          id?: string
          last_confirmed_at?: string | null
          last_seen_at?: string | null
          name?: string
          price?: string | null
          restaurant_id?: string | null
          sides?: string | null
          source_type?: string | null
          start_minutes?: number | null
          start_time?: string | null
          submitted_by?: string | null
          updated_at?: string | null
          valid_to?: string | null
          verification_method?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_deals_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_news: {
        Row: {
          created_at: string | null
          expires_at: string | null
          headline: string
          hook_type: Database["public"]["Enums"]["hook_type"] | null
          id: string
          is_current: boolean
          news_type: string
          published_at: string | null
          restaurant_id: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          headline: string
          hook_type?: Database["public"]["Enums"]["hook_type"] | null
          id?: string
          is_current?: boolean
          news_type: string
          published_at?: string | null
          restaurant_id?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          headline?: string
          hook_type?: Database["public"]["Enums"]["hook_type"] | null
          id?: string
          is_current?: boolean
          news_type?: string
          published_at?: string | null
          restaurant_id?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_news_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_pages: {
        Row: {
          content_hash: string | null
          created_at: string | null
          error_message: string | null
          id: string
          is_pdf: boolean | null
          last_scraped_at: string | null
          page_type: string | null
          pdf_extraction_chars: number | null
          pdf_extraction_status: string | null
          pdf_text_extracted: string | null
          restaurant_id: string | null
          status: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          is_pdf?: boolean | null
          last_scraped_at?: string | null
          page_type?: string | null
          pdf_extraction_chars?: number | null
          pdf_extraction_status?: string | null
          pdf_text_extracted?: string | null
          restaurant_id?: string | null
          status?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          is_pdf?: boolean | null
          last_scraped_at?: string | null
          page_type?: string | null
          pdf_extraction_chars?: number | null
          pdf_extraction_status?: string | null
          pdf_text_extracted?: string | null
          restaurant_id?: string | null
          status?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_pages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reviews: {
        Row: {
          excerpt: string | null
          fetched_at: string | null
          id: string
          platform: string
          rating: number | null
          restaurant_id: string | null
          review_count: number | null
          source_url: string | null
        }
        Insert: {
          excerpt?: string | null
          fetched_at?: string | null
          id?: string
          platform: string
          rating?: number | null
          restaurant_id?: string | null
          review_count?: number | null
          source_url?: string | null
        }
        Update: {
          excerpt?: string | null
          fetched_at?: string | null
          id?: string
          platform?: string
          rating?: number | null
          restaurant_id?: string | null
          review_count?: number | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_scrape_jobs: {
        Row: {
          combined_content: string | null
          completed_at: string | null
          content_sources: Json | null
          created_at: string
          discovered_pages: Json | null
          error_message: string | null
          extraction_confidence: number | null
          extraction_result: Json | null
          id: string
          max_retries: number | null
          pages_scraped: number | null
          priority: number | null
          restaurant_slug: string | null
          retry_count: number | null
          source_id: string | null
          started_at: string | null
          status: string
          total_pages: number | null
          updated_at: string
        }
        Insert: {
          combined_content?: string | null
          completed_at?: string | null
          content_sources?: Json | null
          created_at?: string
          discovered_pages?: Json | null
          error_message?: string | null
          extraction_confidence?: number | null
          extraction_result?: Json | null
          id?: string
          max_retries?: number | null
          pages_scraped?: number | null
          priority?: number | null
          restaurant_slug?: string | null
          retry_count?: number | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          total_pages?: number | null
          updated_at?: string
        }
        Update: {
          combined_content?: string | null
          completed_at?: string | null
          content_sources?: Json | null
          created_at?: string
          discovered_pages?: Json | null
          error_message?: string | null
          extraction_confidence?: number | null
          extraction_result?: Json | null
          id?: string
          max_retries?: number | null
          pages_scraped?: number | null
          priority?: number | null
          restaurant_slug?: string | null
          retry_count?: number | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          total_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_scrape_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          amenities: string[] | null
          business_profile_id: string | null
          categories: string[] | null
          city: string | null
          closing_date: string | null
          closure_reason: string | null
          created_at: string
          cuisine_types: string[] | null
          distinguishing_feature: string | null
          extraction_confidence: Json | null
          extraction_notes: string | null
          facebook_url: string | null
          features: string[] | null
          fish_fry: Json | null
          google_place_id: string | null
          happy_hour: Json | null
          hours: Json | null
          id: string
          is_lakefront: boolean | null
          last_scraped_at: string | null
          local_reputation: string | null
          menu_highlights: string[] | null
          name: string
          needs_review: boolean | null
          opening_date: string | null
          opentable_url: string | null
          phone: string | null
          price_range: string | null
          reservation_required: boolean | null
          signature_dishes: Json | null
          slug: string
          source_url: string | null
          status: string | null
          tags: string[] | null
          updated_at: string
          website: string | null
          weekly_specials: Json | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          business_profile_id?: string | null
          categories?: string[] | null
          city?: string | null
          closing_date?: string | null
          closure_reason?: string | null
          created_at?: string
          cuisine_types?: string[] | null
          distinguishing_feature?: string | null
          extraction_confidence?: Json | null
          extraction_notes?: string | null
          facebook_url?: string | null
          features?: string[] | null
          fish_fry?: Json | null
          google_place_id?: string | null
          happy_hour?: Json | null
          hours?: Json | null
          id?: string
          is_lakefront?: boolean | null
          last_scraped_at?: string | null
          local_reputation?: string | null
          menu_highlights?: string[] | null
          name: string
          needs_review?: boolean | null
          opening_date?: string | null
          opentable_url?: string | null
          phone?: string | null
          price_range?: string | null
          reservation_required?: boolean | null
          signature_dishes?: Json | null
          slug: string
          source_url?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          weekly_specials?: Json | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          business_profile_id?: string | null
          categories?: string[] | null
          city?: string | null
          closing_date?: string | null
          closure_reason?: string | null
          created_at?: string
          cuisine_types?: string[] | null
          distinguishing_feature?: string | null
          extraction_confidence?: Json | null
          extraction_notes?: string | null
          facebook_url?: string | null
          features?: string[] | null
          fish_fry?: Json | null
          google_place_id?: string | null
          happy_hour?: Json | null
          hours?: Json | null
          id?: string
          is_lakefront?: boolean | null
          last_scraped_at?: string | null
          local_reputation?: string | null
          menu_highlights?: string[] | null
          name?: string
          needs_review?: boolean | null
          opening_date?: string | null
          opentable_url?: string | null
          phone?: string | null
          price_range?: string | null
          reservation_required?: boolean | null
          signature_dishes?: Json | null
          slug?: string
          source_url?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          weekly_specials?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_business_profile_id_fkey"
            columns: ["business_profile_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shore_path_stops: {
        Row: {
          approx_mile: number | null
          community: string | null
          created_at: string
          description: string | null
          hero_image_url: string | null
          id: string
          is_public_landmark: boolean
          is_published: boolean
          latitude: number | null
          longitude: number | null
          look_for: string | null
          map_x_pct: number | null
          map_y_pct: number | null
          name: string
          order_index: number
          short_label: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          approx_mile?: number | null
          community?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          is_public_landmark?: boolean
          is_published?: boolean
          latitude?: number | null
          longitude?: number | null
          look_for?: string | null
          map_x_pct?: number | null
          map_y_pct?: number | null
          name: string
          order_index: number
          short_label?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          approx_mile?: number | null
          community?: string | null
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          is_public_landmark?: boolean
          is_published?: boolean
          latitude?: number | null
          longitude?: number | null
          look_for?: string | null
          map_x_pct?: number | null
          map_y_pct?: number | null
          name?: string
          order_index?: number
          short_label?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          category: string | null
          consecutive_zero_runs: number
          content_confidence_score: number
          created_at: string
          default_geo_tier: number | null
          fetch_frequency_minutes: number | null
          health_severity: string
          id: string
          last_error_code: string | null
          last_error_detail: string | null
          last_fetched_at: string | null
          last_items_ingested_count: number
          last_nonzero_run_at: string | null
          last_successful_fetch_at: string | null
          last_zero_items_at: string | null
          metadata: Json | null
          name: string
          source_trust_score: number
          status: string
          supports_events: boolean
          supports_geo_enrichment: boolean
          supports_live_music: boolean
          supports_recurring_events: boolean
          supports_ticket_links: boolean
          trust_locality: boolean
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string | null
          consecutive_zero_runs?: number
          content_confidence_score?: number
          created_at?: string
          default_geo_tier?: number | null
          fetch_frequency_minutes?: number | null
          health_severity?: string
          id?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          last_fetched_at?: string | null
          last_items_ingested_count?: number
          last_nonzero_run_at?: string | null
          last_successful_fetch_at?: string | null
          last_zero_items_at?: string | null
          metadata?: Json | null
          name: string
          source_trust_score?: number
          status?: string
          supports_events?: boolean
          supports_geo_enrichment?: boolean
          supports_live_music?: boolean
          supports_recurring_events?: boolean
          supports_ticket_links?: boolean
          trust_locality?: boolean
          type: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string | null
          consecutive_zero_runs?: number
          content_confidence_score?: number
          created_at?: string
          default_geo_tier?: number | null
          fetch_frequency_minutes?: number | null
          health_severity?: string
          id?: string
          last_error_code?: string | null
          last_error_detail?: string | null
          last_fetched_at?: string | null
          last_items_ingested_count?: number
          last_nonzero_run_at?: string | null
          last_successful_fetch_at?: string | null
          last_zero_items_at?: string | null
          metadata?: Json | null
          name?: string
          source_trust_score?: number
          status?: string
          supports_events?: boolean
          supports_geo_enrichment?: boolean
          supports_live_music?: boolean
          supports_recurring_events?: boolean
          supports_ticket_links?: boolean
          trust_locality?: boolean
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      sponsor_access_tokens: {
        Row: {
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_access_tokens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_invoices: {
        Row: {
          amount_cents: number
          business_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          placement_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          business_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          placement_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          business_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          placement_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_invoices_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "ad_placements"
            referencedColumns: ["id"]
          },
        ]
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
          is_vip: boolean | null
          last_breaking_email_at: string | null
          last_clicked_at: string | null
          last_opened_at: string | null
          metadata: Json | null
          referral_code: string | null
          referral_count: number | null
          referred_by_code: string | null
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
          is_vip?: boolean | null
          last_breaking_email_at?: string | null
          last_clicked_at?: string | null
          last_opened_at?: string | null
          metadata?: Json | null
          referral_code?: string | null
          referral_count?: number | null
          referred_by_code?: string | null
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
          is_vip?: boolean | null
          last_breaking_email_at?: string | null
          last_clicked_at?: string | null
          last_opened_at?: string | null
          metadata?: Json | null
          referral_code?: string | null
          referral_count?: number | null
          referred_by_code?: string | null
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
      sync_skips: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          reason: string
          run_id: string | null
          source_id: string | null
          source_name: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          reason: string
          run_id?: string | null
          source_id?: string | null
          source_name?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string
          run_id?: string | null
          source_id?: string | null
          source_name?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_skips_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
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
      canary_stuck_stories: {
        Row: {
          category: string | null
          created_at: string | null
          geo_tier: number | null
          hold_reason: string | null
          id: string | null
          safety_level: string | null
          source_name: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_feature_eligibility: {
        Args: { p_restaurant_id: string }
        Returns: Json
      }
      cleanup_old_sync_skips: { Args: never; Returns: number }
      expire_old_restaurant_news: { Args: never; Returns: number }
      generate_invoice_number: { Args: never; Returns: string }
      generate_referral_code: { Args: { email_input: string }; Returns: string }
      get_employer_preferences: {
        Args: { _token: string }
        Returns: {
          email: string
          expiry_reminders: boolean
          weekly_digest: boolean
        }[]
      }
      get_skip_stats: { Args: never; Returns: Json }
      get_source_health_stats: {
        Args: never
        Returns: {
          breaking_24h: number
          firecrawl_7d: number
          source_id: string
          stories_24h: number
          stories_7d: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_edge_function: {
        Args: { _body?: Json; _name: string }
        Returns: number
      }
      mark_employer_token_used: { Args: { _token: string }; Returns: undefined }
      mark_sponsor_token_used: { Args: { _token: string }; Returns: undefined }
      normalize_url: { Args: { input: string }; Returns: string }
      set_employer_preference: {
        Args: { _field: string; _token: string; _value: boolean }
        Returns: undefined
      }
      validate_employer_token: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          used_at: string
        }[]
      }
      validate_sponsor_token: {
        Args: { _token: string }
        Returns: {
          business_id: string
          business_name: string
          email: string
          expires_at: string
          used_at: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      hook_type:
        | "event_series"
        | "seasonal_menu"
        | "new_menu"
        | "anniversary"
        | "expansion"
        | "renovation"
        | "reopening"
        | "award"
        | "special_event"
        | "announcement"
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
      hook_type: [
        "event_series",
        "seasonal_menu",
        "new_menu",
        "anniversary",
        "expansion",
        "renovation",
        "reopening",
        "award",
        "special_event",
        "announcement",
      ],
    },
  },
} as const
