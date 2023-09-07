export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      domains: {
        Row: {
          id: number
          inserted_at: string
          name: string
          project_id: string
        }
        Insert: {
          id?: number
          inserted_at?: string
          name: string
          project_id: string
        }
        Update: {
          id?: number
          inserted_at?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "domains_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "domains_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      file_sections: {
        Row: {
          cf_file_meta: Json | null
          cf_project_id: string | null
          content: string | null
          embedding: string | null
          file_id: number
          id: number
          meta: Json | null
          token_count: number | null
        }
        Insert: {
          cf_file_meta?: Json | null
          cf_project_id?: string | null
          content?: string | null
          embedding?: string | null
          file_id: number
          id?: number
          meta?: Json | null
          token_count?: number | null
        }
        Update: {
          cf_file_meta?: Json | null
          cf_project_id?: string | null
          content?: string | null
          embedding?: string | null
          file_id?: number
          id?: number
          meta?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "file_sections_cf_project_id_fkey"
            columns: ["cf_project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_sections_cf_project_id_fkey"
            columns: ["cf_project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "file_sections_cf_project_id_fkey"
            columns: ["cf_project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "file_sections_cf_project_id_fkey"
            columns: ["cf_project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "file_sections_file_id_fkey"
            columns: ["file_id"]
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_sections_file_id_fkey"
            columns: ["file_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["file_id"]
          }
        ]
      }
      files: {
        Row: {
          checksum: string | null
          id: number
          meta: Json | null
          path: string
          project_id: string | null
          raw_content: string | null
          source_id: string | null
          token_count: number | null
          updated_at: string
        }
        Insert: {
          checksum?: string | null
          id?: number
          meta?: Json | null
          path: string
          project_id?: string | null
          raw_content?: string | null
          source_id?: string | null
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          checksum?: string | null
          id?: number
          meta?: Json | null
          path?: string
          project_id?: string | null
          raw_content?: string | null
          source_id?: string | null
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "files_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "sources"
            referencedColumns: ["id"]
          }
        ]
      }
      memberships: {
        Row: {
          id: string
          inserted_at: string
          team_id: string
          type: Database["public"]["Enums"]["membership_type"]
          user_id: string
        }
        Insert: {
          id?: string
          inserted_at?: string
          team_id: string
          type: Database["public"]["Enums"]["membership_type"]
          user_id: string
        }
        Update: {
          id?: string
          inserted_at?: string
          team_id?: string
          type?: Database["public"]["Enums"]["membership_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "memberships_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_users_with_pending_weekly_update_email"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          created_by: string
          github_repo: string | null
          id: string
          inserted_at: string
          is_starter: boolean
          markprompt_config: Json | null
          name: string
          openai_key: string | null
          private_dev_api_key: string
          public_api_key: string
          slug: string
          team_id: string
        }
        Insert: {
          created_by: string
          github_repo?: string | null
          id?: string
          inserted_at?: string
          is_starter?: boolean
          markprompt_config?: Json | null
          name: string
          openai_key?: string | null
          private_dev_api_key: string
          public_api_key: string
          slug: string
          team_id: string
        }
        Update: {
          created_by?: string
          github_repo?: string | null
          id?: string
          inserted_at?: string
          is_starter?: boolean
          markprompt_config?: Json | null
          name?: string
          openai_key?: string | null
          private_dev_api_key?: string
          public_api_key?: string
          slug?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "v_users_with_pending_weekly_update_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["team_id"]
          }
        ]
      }
      prompt_configs: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          project_id: string
          share_key: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          project_id: string
          share_key?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          project_id?: string
          share_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_configs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_configs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "prompt_configs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "prompt_configs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      query_stats: {
        Row: {
          conversation_id: string
          created_at: string
          downvoted: boolean | null
          embedding: string | null
          feedback: Json | null
          id: string
          meta: Json | null
          no_response: boolean | null
          processed: boolean
          processed_state:
            | Database["public"]["Enums"]["query_stat_processed_state"]
            | null
          project_id: string
          prompt: string | null
          prompt_clear: string | null
          reference_paths: string[] | null
          response: string | null
          response_clear: string | null
          upvoted: boolean | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          downvoted?: boolean | null
          embedding?: string | null
          feedback?: Json | null
          id?: string
          meta?: Json | null
          no_response?: boolean | null
          processed?: boolean
          processed_state?:
            | Database["public"]["Enums"]["query_stat_processed_state"]
            | null
          project_id: string
          prompt?: string | null
          prompt_clear?: string | null
          reference_paths?: string[] | null
          response?: string | null
          response_clear?: string | null
          upvoted?: boolean | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          downvoted?: boolean | null
          embedding?: string | null
          feedback?: Json | null
          id?: string
          meta?: Json | null
          no_response?: boolean | null
          processed?: boolean
          processed_state?:
            | Database["public"]["Enums"]["query_stat_processed_state"]
            | null
          project_id?: string
          prompt?: string | null
          prompt_clear?: string | null
          reference_paths?: string[] | null
          response?: string | null
          response_clear?: string | null
          upvoted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      sources: {
        Row: {
          data: Json | null
          id: string
          inserted_at: string
          project_id: string
          type: Database["public"]["Enums"]["source_type"]
        }
        Insert: {
          data?: Json | null
          id?: string
          inserted_at?: string
          project_id: string
          type: Database["public"]["Enums"]["source_type"]
        }
        Update: {
          data?: Json | null
          id?: string
          inserted_at?: string
          project_id?: string
          type?: Database["public"]["Enums"]["source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "sources_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sources_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "sources_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      teams: {
        Row: {
          billing_cycle_start: string | null
          created_by: string
          id: string
          inserted_at: string
          is_personal: boolean | null
          name: string | null
          plan_details: Json | null
          slug: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
        }
        Insert: {
          billing_cycle_start?: string | null
          created_by: string
          id?: string
          inserted_at?: string
          is_personal?: boolean | null
          name?: string | null
          plan_details?: Json | null
          slug: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
        }
        Update: {
          billing_cycle_start?: string | null
          created_by?: string
          id?: string
          inserted_at?: string
          is_personal?: boolean | null
          name?: string | null
          plan_details?: Json | null
          slug?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "v_users_with_pending_weekly_update_email"
            referencedColumns: ["id"]
          }
        ]
      }
      tokens: {
        Row: {
          created_by: string
          id: number
          inserted_at: string
          project_id: string
          value: string
        }
        Insert: {
          created_by: string
          id?: number
          inserted_at?: string
          project_id: string
          value: string
        }
        Update: {
          created_by?: string
          id?: number
          inserted_at?: string
          project_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "v_users_with_pending_weekly_update_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tokens_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tokens_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tokens_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      user_access_tokens: {
        Row: {
          access_token: string | null
          expires: number | null
          id: number
          meta: Json | null
          provider: string | null
          refresh_token: string | null
          refresh_token_expires: number | null
          scope: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          expires?: number | null
          id?: number
          meta?: Json | null
          provider?: string | null
          refresh_token?: string | null
          refresh_token_expires?: number | null
          scope?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          expires?: number | null
          id?: number
          meta?: Json | null
          provider?: string | null
          refresh_token?: string | null
          refresh_token_expires?: number | null
          scope?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_tokens_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_tokens_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_users_with_pending_weekly_update_email"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          config: Json | null
          email: string
          full_name: string | null
          has_completed_onboarding: boolean
          id: string
          last_email_id: string
          outreach_tag: string | null
          subscribe_to_product_updates: boolean
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          config?: Json | null
          email: string
          full_name?: string | null
          has_completed_onboarding?: boolean
          id: string
          last_email_id?: string
          outreach_tag?: string | null
          subscribe_to_product_updates?: boolean
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          config?: Json | null
          email?: string
          full_name?: string | null
          has_completed_onboarding?: boolean
          id?: string
          last_email_id?: string
          outreach_tag?: string | null
          subscribe_to_product_updates?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      decrypted_query_stats: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          decrypted_prompt: string | null
          decrypted_response: string | null
          downvoted: boolean | null
          embedding: string | null
          feedback: Json | null
          id: string | null
          meta: Json | null
          no_response: boolean | null
          processed: boolean | null
          processed_state:
            | Database["public"]["Enums"]["query_stat_processed_state"]
            | null
          project_id: string | null
          prompt: string | null
          prompt_clear: string | null
          reference_paths: string[] | null
          response: string | null
          response_clear: string | null
          upvoted: boolean | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          decrypted_prompt?: never
          decrypted_response?: never
          downvoted?: boolean | null
          embedding?: string | null
          feedback?: Json | null
          id?: string | null
          meta?: Json | null
          no_response?: boolean | null
          processed?: boolean | null
          processed_state?:
            | Database["public"]["Enums"]["query_stat_processed_state"]
            | null
          project_id?: string | null
          prompt?: string | null
          prompt_clear?: string | null
          reference_paths?: string[] | null
          response?: string | null
          response_clear?: string | null
          upvoted?: boolean | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          decrypted_prompt?: never
          decrypted_response?: never
          downvoted?: boolean | null
          embedding?: string | null
          feedback?: Json | null
          id?: string | null
          meta?: Json | null
          no_response?: boolean | null
          processed?: boolean | null
          processed_state?:
            | Database["public"]["Enums"]["query_stat_processed_state"]
            | null
          project_id?: string | null
          prompt?: string | null
          prompt_clear?: string | null
          reference_paths?: string[] | null
          response?: string | null
          response_clear?: string | null
          upvoted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_conversation_id_fkey"
            columns: ["conversation_id"]
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_distinct_unprocessed_query_stats_project_ids: {
        Row: {
          min_created_at: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_file_section_search_infos: {
        Row: {
          domain: string | null
          file_id: number | null
          file_meta: Json | null
          file_path: string | null
          private_dev_api_key: string | null
          project_id: string | null
          public_api_key: string | null
          section_content: string | null
          section_meta: Json | null
          source_data: Json | null
          source_type: Database["public"]["Enums"]["source_type"] | null
          stripe_price_id: string | null
          token: string | null
        }
        Relationships: []
      }
      v_insights_query_histogram_day: {
        Row: {
          count: number | null
          date: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_insights_query_histogram_hour: {
        Row: {
          count: number | null
          date: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_insights_query_histogram_month: {
        Row: {
          count: number | null
          date: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_insights_query_histogram_week: {
        Row: {
          count: number | null
          date: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_insights_query_histogram_year: {
        Row: {
          count: number | null
          date: string | null
          project_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_file_section_search_infos"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_info"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "query_stats_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "v_team_project_usage_info"
            referencedColumns: ["project_id"]
          }
        ]
      }
      v_team_project_info: {
        Row: {
          plan_details: Json | null
          project_id: string | null
          stripe_price_id: string | null
          team_id: string | null
        }
        Relationships: []
      }
      v_team_project_usage_info: {
        Row: {
          plan_details: Json | null
          project_id: string | null
          stripe_price_id: string | null
          team_id: string | null
          team_token_count: number | null
        }
        Relationships: []
      }
      v_users_with_pending_weekly_update_email: {
        Row: {
          config: Json | null
          email: string | null
          id: string | null
          plan_details: Json | null
          stripe_price_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Functions: {
      create_fts_index: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_idx_file_sections_fts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fts: {
        Args: {
          search_term: string
          match_count: number
          project_id: string
        }
        Returns: {
          id: number
          content: string
          meta: Json
          file_id: number
          file_meta: Json
        }[]
      }
      fts_file_section_content: {
        Args: {
          search_term: string
          match_count: number
          project_id: string
        }
        Returns: {
          id: number
          content: string
          meta: Json
          file_id: number
        }[]
      }
      fts_file_title: {
        Args: {
          search_term: string
          match_count: number
          project_id: string
        }
        Returns: {
          id: number
        }[]
      }
      get_insights_query_histogram: {
        Args: {
          project_id: string
          from_tz: string
          to_tz: string
          tz: string
          trunc_interval: string
        }
        Returns: {
          date: string
          occurrences: number
        }[]
      }
      get_most_cited_references_stats: {
        Args: {
          project_id: string
          from_tz: string
          to_tz: string
          max_results: number
        }
        Returns: {
          full_path: string
          path: string
          slug: string
          title: string
          heading: string
          occurrences: number
        }[]
      }
      get_project_file_stats: {
        Args: {
          project_id: string
        }
        Returns: {
          num_files: number
          num_sections: number
          num_tokens: number
        }[]
      }
      get_project_query_stats: {
        Args: {
          project_id: string
          from_tz: string
          to_tz: string
        }
        Returns: {
          num_queries: number
          num_unanswered: number
          num_upvotes: number
          num_downvotes: number
        }[]
      }
      get_team_insights_query_histogram: {
        Args: {
          team_id: string
          from_tz: string
          to_tz: string
          tz: string
          trunc_interval: string
        }
        Returns: {
          date: string
          occurrences: number
        }[]
      }
      get_team_num_completions: {
        Args: {
          team_id: string
          from_tz: string
          to_tz: string
        }
        Returns: {
          occurrences: number
        }[]
      }
      get_team_stats: {
        Args: {
          team_id: string
        }
        Returns: {
          project_id: string
          project_name: string
          project_slug: string
          num_files: number
          num_file_sections: number
          num_tokens: number
        }[]
      }
      is_project_accessible_to_user: {
        Args: {
          user_id: string
          project_id: string
        }
        Returns: {
          has_access: boolean
        }[]
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      match_file_sections: {
        Args: {
          project_id: string
          embedding: string
          match_threshold: number
          match_count: number
          min_content_length: number
        }
        Returns: {
          files_path: string
          files_meta: Json
          file_sections_content: string
          file_sections_meta: Json
          file_sections_token_count: number
          file_sections_similarity: number
          source_type: Database["public"]["Enums"]["source_type"]
          source_data: Json
        }[]
      }
      query_stats_top_references: {
        Args: {
          project_id: string
          from_tz: string
          to_tz: string
          match_count: number
        }
        Returns: {
          path: string
          source_type: string
          source_data: Json
          occurrences: number
        }[]
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      membership_type: "viewer" | "admin"
      processed_type: "processed" | "ignored"
      query_stat_processed_state:
        | "processed"
        | "unprocessed"
        | "errored"
        | "skipped"
      source_type: "github" | "motif" | "website" | "file-upload" | "api-upload"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
