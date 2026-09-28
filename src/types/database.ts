// Generated from the Supabase project schema (`npx supabase gen types
// typescript`). Do not hand-edit — regenerate after changing migrations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      books: {
        Row: {
          accent_color: string | null
          added_by: string
          author: string | null
          created_at: string
          default_cover_id: string | null
          group_id: string
          id: string
          open_library_cover_url: string | null
          open_library_id: string | null
          title: string
        }
        Insert: {
          accent_color?: string | null
          added_by: string
          author?: string | null
          created_at?: string
          default_cover_id?: string | null
          group_id: string
          id?: string
          open_library_cover_url?: string | null
          open_library_id?: string | null
          title: string
        }
        Update: {
          accent_color?: string | null
          added_by?: string
          author?: string | null
          created_at?: string
          default_cover_id?: string | null
          group_id?: string
          id?: string
          open_library_cover_url?: string | null
          open_library_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_default_cover_id_fkey"
            columns: ["default_cover_id"]
            isOneToOne: false
            referencedRelation: "covers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_edits: {
        Row: {
          book_id: string
          created_at: string
          id: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          snapshot: Json
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_edits_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_edits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          book_id: string
          created_at: string
          id: string
          label: string
          part_label: string | null
          position: number
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          label: string
          part_label?: string | null
          position: number
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          label?: string
          part_label?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          book_id: string
          chapter_id: string
          created_at: string
          flagged: boolean
          id: string
          made_during_reread: boolean
          no_spoilers: boolean
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          book_id: string
          chapter_id: string
          created_at?: string
          flagged?: boolean
          id?: string
          made_during_reread?: boolean
          no_spoilers?: boolean
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          book_id?: string
          chapter_id?: string
          created_at?: string
          flagged?: boolean
          id?: string
          made_during_reread?: boolean
          no_spoilers?: boolean
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      covers: {
        Row: {
          book_id: string
          created_at: string
          id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "covers_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "covers_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          notification_prefs: Json
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          notification_prefs?: Json
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          notification_prefs?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          body: string
          book_id: string
          chapter_id: string
          created_at: string
          id: string
          resolved_at: string | null
          user_id: string
          verdict: string | null
        }
        Insert: {
          body: string
          book_id: string
          chapter_id: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          user_id: string
          verdict?: string | null
        }
        Update: {
          body?: string
          book_id?: string
          chapter_id?: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          user_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          book_id: string
          created_at: string
          id: string
          is_dnf: boolean
          is_reread: boolean
          review: string | null
          stars: number
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          is_dnf?: boolean
          is_reread?: boolean
          review?: string | null
          stars: number
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          is_dnf?: boolean
          is_reread?: boolean
          review?: string | null
          stars?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_entries: {
        Row: {
          book_id: string
          created_at: string
          current_chapter_id: string | null
          finished_at: string | null
          id: string
          is_rereading: boolean
          muted: boolean
          personal_cover_id: string | null
          sort_pref: string
          spoil_me: boolean
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          current_chapter_id?: string | null
          finished_at?: string | null
          id?: string
          is_rereading?: boolean
          muted?: boolean
          personal_cover_id?: string | null
          sort_pref?: string
          spoil_me?: boolean
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          current_chapter_id?: string | null
          finished_at?: string | null
          id?: string
          is_rereading?: boolean
          muted?: boolean
          personal_cover_id?: string | null
          sort_pref?: string
          spoil_me?: boolean
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_entries_current_chapter_id_fkey"
            columns: ["current_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_entries_personal_cover_id_fkey"
            columns: ["personal_cover_id"]
            isOneToOne: false
            referencedRelation: "covers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spoiler_blocks: {
        Row: {
          book_id: string
          chapter_id: string
          comment_id: string
          content: string
          created_at: string
          id: string
          ordinal: number
        }
        Insert: {
          book_id: string
          chapter_id: string
          comment_id: string
          content: string
          created_at?: string
          id?: string
          ordinal: number
        }
        Update: {
          book_id?: string
          chapter_id?: string
          comment_id?: string
          content?: string
          created_at?: string
          id?: string
          ordinal?: number
        }
        Relationships: [
          {
            foreignKeyName: "spoiler_blocks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spoiler_blocks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spoiler_blocks_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
      }
      flag_comment: { Args: { p_comment_id: string }; Returns: undefined }
      generate_invite_code: { Args: never; Returns: string }
      has_full_access: {
        Args: { p_book_id: string; p_user_id: string }
        Returns: boolean
      }
      is_chapter_unlocked: {
        Args: { p_book_id: string; p_chapter_id: string; p_user_id: string }
        Returns: boolean
      }
      is_currently_reading: { Args: { p_book_id: string }; Returns: boolean }
      is_group_admin: { Args: { p_group_id: string }; Returns: boolean }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      join_group_by_code: {
        Args: { p_invite_code: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
      }
      locked_comment_count: { Args: { p_book_id: string }; Returns: number }
      prediction_scoreboard: {
        Args: { p_book_id: string }
        Returns: {
          correct: number
          display_name: string
          incorrect: number
          total: number
          unclear: number
          user_id: string
        }[]
      }
      resolve_comment_flag: {
        Args: { p_comment_id: string; p_new_chapter_id?: string }
        Returns: undefined
      }
      set_default_cover: {
        Args: { p_book_id: string; p_cover_id: string }
        Returns: {
          accent_color: string | null
          added_by: string
          author: string | null
          created_at: string
          default_cover_id: string | null
          group_id: string
          id: string
          open_library_cover_url: string | null
          open_library_id: string | null
          title: string
        }
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

type DefaultSchema = Database["public"]

export type Tables<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<
  T extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][T]["Update"]
