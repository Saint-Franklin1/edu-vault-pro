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
      application_review_events: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          amount_recommended: number | null
          application_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["application_stage"] | null
          id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          amount_recommended?: number | null
          application_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["application_stage"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          amount_recommended?: number | null
          application_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["application_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "application_review_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      bursaries: {
        Row: {
          application_link: string
          constituency_id: string | null
          county_id: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deleted_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          application_link: string
          constituency_id?: string | null
          county_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          application_link?: string
          constituency_id?: string | null
          county_id?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bursaries_constituency_id_fkey"
            columns: ["constituency_id"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bursaries_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bursaries_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      bursary_applications: {
        Row: {
          account_name: string | null
          account_number: string | null
          admission_number: string | null
          amount_requested: number | null
          approved_amount: number | null
          bank_branch: string | null
          bank_name: string | null
          bursary_id: string
          course: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["application_stage"]
          declaration_signed_at: string | null
          expected_completion_year: number | null
          fee_structure_doc_id: string | null
          guardian_name: string | null
          guardian_occupation: string | null
          guardian_relationship: string | null
          has_disability: boolean | null
          household_income_bracket: string | null
          id: string
          institution_name: string | null
          message: string | null
          mpesa_number: string | null
          other_fees: number | null
          parents_status: string | null
          recommended_amount: number | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          siblings_in_school: number | null
          status: string
          student_id: string
          study_level: string | null
          tuition_required: number | null
          updated_at: string
          upkeep_required: number | null
          year_of_study: number | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          admission_number?: string | null
          amount_requested?: number | null
          approved_amount?: number | null
          bank_branch?: string | null
          bank_name?: string | null
          bursary_id: string
          course?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["application_stage"]
          declaration_signed_at?: string | null
          expected_completion_year?: number | null
          fee_structure_doc_id?: string | null
          guardian_name?: string | null
          guardian_occupation?: string | null
          guardian_relationship?: string | null
          has_disability?: boolean | null
          household_income_bracket?: string | null
          id?: string
          institution_name?: string | null
          message?: string | null
          mpesa_number?: string | null
          other_fees?: number | null
          parents_status?: string | null
          recommended_amount?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          siblings_in_school?: number | null
          status?: string
          student_id: string
          study_level?: string | null
          tuition_required?: number | null
          updated_at?: string
          upkeep_required?: number | null
          year_of_study?: number | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          admission_number?: string | null
          amount_requested?: number | null
          approved_amount?: number | null
          bank_branch?: string | null
          bank_name?: string | null
          bursary_id?: string
          course?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["application_stage"]
          declaration_signed_at?: string | null
          expected_completion_year?: number | null
          fee_structure_doc_id?: string | null
          guardian_name?: string | null
          guardian_occupation?: string | null
          guardian_relationship?: string | null
          has_disability?: boolean | null
          household_income_bracket?: string | null
          id?: string
          institution_name?: string | null
          message?: string | null
          mpesa_number?: string | null
          other_fees?: number | null
          parents_status?: string | null
          recommended_amount?: number | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          siblings_in_school?: number | null
          status?: string
          student_id?: string
          study_level?: string | null
          tuition_required?: number | null
          updated_at?: string
          upkeep_required?: number | null
          year_of_study?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bursary_applications_bursary_id_fkey"
            columns: ["bursary_id"]
            isOneToOne: false
            referencedRelation: "bursaries"
            referencedColumns: ["id"]
          },
        ]
      }
      constituencies: {
        Row: {
          county_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          county_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          county_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "constituencies_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
        ]
      }
      counties: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      disbursements: {
        Row: {
          amount: number
          application_id: string
          channel: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string
          receipt_path: string | null
          recorded_by: string
          reference_number: string
        }
        Insert: {
          amount: number
          application_id: string
          channel: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          receipt_path?: string | null
          recorded_by: string
          reference_number: string
        }
        Update: {
          amount?: number
          application_id?: string
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string
          receipt_path?: string | null
          recorded_by?: string
          reference_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "disbursements_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "bursary_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          chief_approved: boolean
          chief_approved_at: string | null
          chief_approved_by: string | null
          chief_category: string | null
          chief_notes: string | null
          constituency_approved: boolean
          constituency_approved_at: string | null
          constituency_approved_by: string | null
          county_approved: boolean
          county_approved_at: string | null
          county_approved_by: string | null
          created_at: string
          deleted_at: string | null
          document_type: string | null
          file_name: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          recommendation_letter_url: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string
          title: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
          ward_approved: boolean
          ward_approved_at: string | null
          ward_approved_by: string | null
        }
        Insert: {
          chief_approved?: boolean
          chief_approved_at?: string | null
          chief_approved_by?: string | null
          chief_category?: string | null
          chief_notes?: string | null
          constituency_approved?: boolean
          constituency_approved_at?: string | null
          constituency_approved_by?: string | null
          county_approved?: boolean
          county_approved_at?: string | null
          county_approved_by?: string | null
          created_at?: string
          deleted_at?: string | null
          document_type?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          recommendation_letter_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
          ward_approved?: boolean
          ward_approved_at?: string | null
          ward_approved_by?: string | null
        }
        Update: {
          chief_approved?: boolean
          chief_approved_at?: string | null
          chief_approved_by?: string | null
          chief_category?: string | null
          chief_notes?: string | null
          constituency_approved?: boolean
          constituency_approved_at?: string | null
          constituency_approved_by?: string | null
          county_approved?: boolean
          county_approved_at?: string | null
          county_approved_by?: string | null
          created_at?: string
          deleted_at?: string | null
          document_type?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          recommendation_letter_url?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
          ward_approved?: boolean
          ward_approved_at?: string | null
          ward_approved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_status: Database["public"]["Enums"]["admin_status"]
          constituency_id: string | null
          county_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          updated_at: string
          ward_id: string | null
        }
        Insert: {
          admin_status?: Database["public"]["Enums"]["admin_status"]
          constituency_id?: string | null
          county_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
          ward_id?: string | null
        }
        Update: {
          admin_status?: Database["public"]["Enums"]["admin_status"]
          constituency_id?: string | null
          county_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
          ward_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_constituency_id_fkey"
            columns: ["constituency_id"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_handovers: {
        Row: {
          ai_match_score: number | null
          ai_reasoning: string | null
          completed_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          initiated_by: string
          national_id_number: string
          national_id_photo_path: string | null
          new_user_id: string | null
          phone: string
          rejection_reason: string | null
          selfie_photo_path: string | null
          status: Database["public"]["Enums"]["handover_status"]
          updated_at: string
        }
        Insert: {
          ai_match_score?: number | null
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          initiated_by: string
          national_id_number: string
          national_id_photo_path?: string | null
          new_user_id?: string | null
          phone: string
          rejection_reason?: string | null
          selfie_photo_path?: string | null
          status?: Database["public"]["Enums"]["handover_status"]
          updated_at?: string
        }
        Update: {
          ai_match_score?: number | null
          ai_reasoning?: string | null
          completed_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          initiated_by?: string
          national_id_number?: string
          national_id_photo_path?: string | null
          new_user_id?: string | null
          phone?: string
          rejection_reason?: string | null
          selfie_photo_path?: string | null
          status?: Database["public"]["Enums"]["handover_status"]
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
      wards: {
        Row: {
          constituency_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          constituency_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          constituency_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "wards_constituency_id_fkey"
            columns: ["constituency_id"]
            isOneToOne: false
            referencedRelation: "constituencies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_can_access_user: {
        Args: { _target_user: string }
        Returns: boolean
      }
      finalize_super_admin_handover: {
        Args: { _handover_id: string; _new_user: string }
        Returns: undefined
      }
      find_user_by_email: {
        Args: { _email: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      get_my_geo: {
        Args: never
        Returns: {
          constituency_id: string
          county_id: string
          ward_id: string
        }[]
      }
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_public_verified_documents: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          mime_type: string
          title: string
          verified_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_action: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _metadata: Json
        }
        Returns: undefined
      }
      promote_user_to_admin: {
        Args: {
          _constituency: string
          _county: string
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
          _ward: string
        }
        Returns: undefined
      }
      report_application_summary: {
        Args: { _from: string; _to: string }
        Returns: {
          approved: number
          avg_disbursement: number
          disbursed: number
          funds_approved: number
          funds_disbursed: number
          funds_requested: number
          pending: number
          rejected: number
          total_applications: number
        }[]
      }
      report_by_program: {
        Args: { _from: string; _to: string }
        Returns: {
          applicants: number
          approved: number
          bursary_id: string
          disbursed_amount: number
          rejected: number
          title: string
        }[]
      }
      report_disbursements: {
        Args: { _from: string; _to: string }
        Returns: {
          amount: number
          application_id: string
          bursary_title: string
          channel: string
          disbursement_id: string
          paid_at: string
          reference_number: string
          student_name: string
        }[]
      }
      report_rejections_by_reason: {
        Args: { _from: string; _to: string }
        Returns: {
          count: number
          reason: string
        }[]
      }
      set_admin_status: {
        Args: {
          _reason: string
          _status: Database["public"]["Enums"]["admin_status"]
          _target: string
        }
        Returns: undefined
      }
    }
    Enums: {
      admin_status: "active" | "suspended" | "banned" | "deleted"
      app_role:
        | "student"
        | "ward_admin"
        | "constituency_admin"
        | "county_admin"
        | "super_admin"
        | "chief"
      application_stage:
        | "submitted"
        | "ward_reviewed"
        | "constituency_reviewed"
        | "county_approved"
        | "disbursed"
        | "rejected"
        | "withdrawn"
      document_status: "pending" | "in_queue" | "verified" | "rejected"
      handover_status:
        | "pending_email_verification"
        | "pending_ai_review"
        | "approved"
        | "rejected"
        | "expired"
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
      admin_status: ["active", "suspended", "banned", "deleted"],
      app_role: [
        "student",
        "ward_admin",
        "constituency_admin",
        "county_admin",
        "super_admin",
        "chief",
      ],
      application_stage: [
        "submitted",
        "ward_reviewed",
        "constituency_reviewed",
        "county_approved",
        "disbursed",
        "rejected",
        "withdrawn",
      ],
      document_status: ["pending", "in_queue", "verified", "rejected"],
      handover_status: [
        "pending_email_verification",
        "pending_ai_review",
        "approved",
        "rejected",
        "expired",
      ],
    },
  },
} as const
