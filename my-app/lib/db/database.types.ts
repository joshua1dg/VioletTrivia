export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      batch_questions: {
        Row: {
          batch_id: string
          position: number
          question_id: string
        }
        Insert: {
          batch_id: string
          position: number
          question_id: string
        }
        Update: {
          batch_id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_questions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          async_sample_size: number | null
          audience: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active_async: boolean
          name: string
          owner_id: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["batch_status"]
          token: string
        }
        Insert: {
          async_sample_size?: number | null
          audience?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active_async?: boolean
          name: string
          owner_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          token: string
        }
        Update: {
          async_sample_size?: number | null
          audience?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active_async?: boolean
          name?: string
          owner_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          token?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          batch_id: string
          current_position: number | null
          current_question_id: string | null
          ended_at: string | null
          host_id: string | null
          id: string
          phase: Database["public"]["Enums"]["session_phase"]
          response_count: number
          room_number: number
          started_at: string | null
        }
        Insert: {
          batch_id: string
          current_position?: number | null
          current_question_id?: string | null
          ended_at?: string | null
          host_id?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["session_phase"]
          response_count?: number
          room_number?: number
          started_at?: string | null
        }
        Update: {
          batch_id?: string
          current_position?: number | null
          current_question_id?: string | null
          ended_at?: string | null
          host_id?: string | null
          id?: string
          phase?: Database["public"]["Enums"]["session_phase"]
          response_count?: number
          room_number?: number
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_current_question_id_fkey"
            columns: ["current_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["user_id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          display_name: string | null
          entry_batch: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          entry_batch?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          entry_batch?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_entry_batch_fkey"
            columns: ["entry_batch"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      principles: {
        Row: {
          active: boolean
          code: string
          full_description: string | null
          id: string
          name: string
          short_descriptor: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          code: string
          full_description?: string | null
          id?: string
          name: string
          short_descriptor?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          code?: string
          full_description?: string | null
          id?: string
          name?: string
          short_descriptor?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      question_principles: {
        Row: {
          principle_id: string
          question_id: string
        }
        Insert: {
          principle_id: string
          question_id: string
        }
        Update: {
          principle_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_principles_principle_id_fkey"
            columns: ["principle_id"]
            isOneToOne: false
            referencedRelation: "principles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_principles_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_topics: {
        Row: {
          question_id: string
          topic_id: string
        }
        Insert: {
          question_id: string
          topic_id: string
        }
        Update: {
          question_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_key: Json
          author_id: string | null
          content: Json
          created_at: string
          id: string
          prompt: string
          status: Database["public"]["Enums"]["question_status"]
          template: Database["public"]["Enums"]["template_type"]
          updated_at: string
        }
        Insert: {
          answer_key: Json
          author_id?: string | null
          content: Json
          created_at?: string
          id?: string
          prompt: string
          status?: Database["public"]["Enums"]["question_status"]
          template: Database["public"]["Enums"]["template_type"]
          updated_at?: string
        }
        Update: {
          answer_key?: Json
          author_id?: string | null
          content?: Json
          created_at?: string
          id?: string
          prompt?: string
          status?: Database["public"]["Enums"]["question_status"]
          template?: Database["public"]["Enums"]["template_type"]
          updated_at?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          answer: Json
          batch_id: string | null
          created_at: string
          id: string
          live_session_id: string | null
          participant_id: string
          question_id: string
          rationale: string | null
        }
        Insert: {
          answer: Json
          batch_id?: string | null
          created_at?: string
          id?: string
          live_session_id?: string | null
          participant_id: string
          question_id: string
          rationale?: string | null
        }
        Update: {
          answer?: Json
          batch_id?: string | null
          created_at?: string
          id?: string
          live_session_id?: string | null
          participant_id?: string
          question_id?: string
          rationale?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          joined_at: string
          live_session_id: string
          participant_id: string
        }
        Insert: {
          joined_at?: string
          live_session_id: string
          participant_id: string
        }
        Update: {
          joined_at?: string
          live_session_id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          label: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          slug?: string
          sort_order?: number
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
      batch_status: "draft" | "active" | "inactive"
      question_status: "draft" | "live" | "archived"
      session_phase: "lobby" | "voting" | "locked" | "revealed" | "ended"
      staff_role: "admin" | "host"
      template_type: "which_principle" | "rank_variants" | "write_feedback"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      batch_status: ["draft", "active", "inactive"],
      question_status: ["draft", "live", "archived"],
      session_phase: ["lobby", "voting", "locked", "revealed", "ended"],
      staff_role: ["admin", "host"],
      template_type: ["which_principle", "rank_variants", "write_feedback"],
    },
  },
} as const

