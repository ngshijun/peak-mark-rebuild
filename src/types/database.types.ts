export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5'
  }
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
      child_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          next_billing_date: string | null
          parent_id: string
          start_date: string
          student_id: string
          tier: Database['public']['Enums']['subscription_tier']
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          next_billing_date?: string | null
          parent_id: string
          start_date?: string
          student_id: string
          tier?: Database['public']['Enums']['subscription_tier']
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          next_billing_date?: string | null
          parent_id?: string
          start_date?: string
          student_id?: string
          tier?: Database['public']['Enums']['subscription_tier']
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'child_subscriptions_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'child_subscriptions_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'child_subscriptions_student_id_fkey'
            columns: ['student_id']
            isOneToOne: true
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'child_subscriptions_student_id_fkey'
            columns: ['student_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      daily_statuses: {
        Row: {
          created_at: string | null
          date: string
          has_practiced: boolean | null
          has_spun: boolean | null
          id: string
          mood: Database['public']['Enums']['mood_type'] | null
          spin_reward: number | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          has_practiced?: boolean | null
          has_spun?: boolean | null
          id?: string
          mood?: Database['public']['Enums']['mood_type'] | null
          spin_reward?: number | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          has_practiced?: boolean | null
          has_spun?: boolean | null
          id?: string
          mood?: Database['public']['Enums']['mood_type'] | null
          spin_reward?: number | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'daily_statuses_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'daily_statuses_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      grade_levels: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      owned_pets: {
        Row: {
          count: number | null
          created_at: string | null
          food_fed: number
          id: string
          pet_id: string
          student_id: string
          tier: number
          updated_at: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          food_fed?: number
          id?: string
          pet_id: string
          student_id: string
          tier?: number
          updated_at?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          food_fed?: number
          id?: string
          pet_id?: string
          student_id?: string
          tier?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'owned_pets_pet_id_fkey'
            columns: ['pet_id']
            isOneToOne: false
            referencedRelation: 'pets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'owned_pets_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'owned_pets_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      parent_profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'parent_profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      parent_student_invitations: {
        Row: {
          created_at: string | null
          direction: Database['public']['Enums']['invitation_direction']
          id: string
          parent_email: string
          parent_id: string | null
          responded_at: string | null
          status: Database['public']['Enums']['invitation_status'] | null
          student_email: string
          student_id: string | null
        }
        Insert: {
          created_at?: string | null
          direction: Database['public']['Enums']['invitation_direction']
          id?: string
          parent_email: string
          parent_id?: string | null
          responded_at?: string | null
          status?: Database['public']['Enums']['invitation_status'] | null
          student_email: string
          student_id?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: Database['public']['Enums']['invitation_direction']
          id?: string
          parent_email?: string
          parent_id?: string | null
          responded_at?: string | null
          status?: Database['public']['Enums']['invitation_status'] | null
          student_email?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'parent_student_invitations_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_student_invitations_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_student_invitations_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_student_invitations_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      parent_student_links: {
        Row: {
          id: string
          linked_at: string | null
          parent_id: string
          student_id: string
        }
        Insert: {
          id?: string
          linked_at?: string | null
          parent_id: string
          student_id: string
        }
        Update: {
          id?: string
          linked_at?: string | null
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'parent_student_links_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_student_links_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_student_links_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'parent_student_links_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pets: {
        Row: {
          created_at: string | null
          gacha_weight: number | null
          id: string
          image_path: string
          name: string
          rarity: Database['public']['Enums']['pet_rarity']
          tier2_image_path: string | null
          tier3_image_path: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gacha_weight?: number | null
          id?: string
          image_path: string
          name: string
          rarity: Database['public']['Enums']['pet_rarity']
          tier2_image_path?: string | null
          tier3_image_path?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gacha_weight?: number | null
          id?: string
          image_path?: string
          name?: string
          rarity?: Database['public']['Enums']['pet_rarity']
          tier2_image_path?: string | null
          tier3_image_path?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      practice_answers: {
        Row: {
          answered_at: string | null
          id: string
          is_correct: boolean
          question_id: string | null
          selected_options: number[] | null
          session_id: string
          text_answer: string | null
          time_spent_seconds: number | null
        }
        Insert: {
          answered_at?: string | null
          id?: string
          is_correct: boolean
          question_id?: string | null
          selected_options?: number[] | null
          session_id: string
          text_answer?: string | null
          time_spent_seconds?: number | null
        }
        Update: {
          answered_at?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string | null
          selected_options?: number[] | null
          session_id?: string
          text_answer?: string | null
          time_spent_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'practice_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'question_statistics'
            referencedColumns: ['question_id']
          },
          {
            foreignKeyName: 'practice_answers_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_answers_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'practice_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      practice_sessions: {
        Row: {
          ai_summary: string | null
          coins_earned: number | null
          completed_at: string | null
          correct_count: number | null
          created_at: string | null
          current_question_index: number | null
          grade_level_id: string | null
          id: string
          student_id: string
          subject_id: string | null
          topic_id: string
          total_questions: number
          total_time_seconds: number | null
          xp_earned: number | null
        }
        Insert: {
          ai_summary?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          correct_count?: number | null
          created_at?: string | null
          current_question_index?: number | null
          grade_level_id?: string | null
          id?: string
          student_id: string
          subject_id?: string | null
          topic_id: string
          total_questions: number
          total_time_seconds?: number | null
          xp_earned?: number | null
        }
        Update: {
          ai_summary?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          correct_count?: number | null
          created_at?: string | null
          current_question_index?: number | null
          grade_level_id?: string | null
          id?: string
          student_id?: string
          subject_id?: string | null
          topic_id?: string
          total_questions?: number
          total_time_seconds?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'practice_sessions_grade_level_id_fkey'
            columns: ['grade_level_id']
            isOneToOne: false
            referencedRelation: 'grade_levels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_sessions_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_sessions_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_sessions_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'practice_sessions_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'sub_topics'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          id: string
          name: string
          updated_at: string | null
          user_type: Database['public']['Enums']['user_type']
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          id: string
          name: string
          updated_at?: string | null
          user_type: Database['public']['Enums']['user_type']
        }
        Update: {
          avatar_path?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          updated_at?: string | null
          user_type?: Database['public']['Enums']['user_type']
        }
        Relationships: []
      }
      question_feedback: {
        Row: {
          category: Database['public']['Enums']['feedback_category']
          comments: string | null
          created_at: string | null
          id: string
          question_id: string
          reported_by: string
        }
        Insert: {
          category: Database['public']['Enums']['feedback_category']
          comments?: string | null
          created_at?: string | null
          id?: string
          question_id: string
          reported_by: string
        }
        Update: {
          category?: Database['public']['Enums']['feedback_category']
          comments?: string | null
          created_at?: string | null
          id?: string
          question_id?: string
          reported_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'question_feedback_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'question_statistics'
            referencedColumns: ['question_id']
          },
          {
            foreignKeyName: 'question_feedback_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'question_feedback_reported_by_fkey'
            columns: ['reported_by']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'question_feedback_reported_by_fkey'
            columns: ['reported_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      questions: {
        Row: {
          answer: string | null
          created_at: string | null
          explanation: string | null
          grade_level_id: string | null
          id: string
          image_path: string | null
          option_1_image_path: string | null
          option_1_is_correct: boolean | null
          option_1_text: string | null
          option_2_image_path: string | null
          option_2_is_correct: boolean | null
          option_2_text: string | null
          option_3_image_path: string | null
          option_3_is_correct: boolean | null
          option_3_text: string | null
          option_4_image_path: string | null
          option_4_is_correct: boolean | null
          option_4_text: string | null
          question: string
          subject_id: string | null
          topic_id: string
          type: Database['public']['Enums']['question_type']
          updated_at: string
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          explanation?: string | null
          grade_level_id?: string | null
          id?: string
          image_path?: string | null
          option_1_image_path?: string | null
          option_1_is_correct?: boolean | null
          option_1_text?: string | null
          option_2_image_path?: string | null
          option_2_is_correct?: boolean | null
          option_2_text?: string | null
          option_3_image_path?: string | null
          option_3_is_correct?: boolean | null
          option_3_text?: string | null
          option_4_image_path?: string | null
          option_4_is_correct?: boolean | null
          option_4_text?: string | null
          question: string
          subject_id?: string | null
          topic_id: string
          type: Database['public']['Enums']['question_type']
          updated_at?: string
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          explanation?: string | null
          grade_level_id?: string | null
          id?: string
          image_path?: string | null
          option_1_image_path?: string | null
          option_1_is_correct?: boolean | null
          option_1_text?: string | null
          option_2_image_path?: string | null
          option_2_is_correct?: boolean | null
          option_2_text?: string | null
          option_3_image_path?: string | null
          option_3_is_correct?: boolean | null
          option_3_text?: string | null
          option_4_image_path?: string | null
          option_4_is_correct?: boolean | null
          option_4_text?: string | null
          question?: string
          subject_id?: string | null
          topic_id?: string
          type?: Database['public']['Enums']['question_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'questions_grade_level_id_fkey'
            columns: ['grade_level_id']
            isOneToOne: false
            referencedRelation: 'grade_levels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'sub_topics'
            referencedColumns: ['id']
          },
        ]
      }
      session_questions: {
        Row: {
          id: string
          question_id: string
          question_order: number
          session_id: string
        }
        Insert: {
          id?: string
          question_id: string
          question_order: number
          session_id: string
        }
        Update: {
          id?: string
          question_id?: string
          question_order?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'session_questions_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'question_statistics'
            referencedColumns: ['question_id']
          },
          {
            foreignKeyName: 'session_questions_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'session_questions_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'practice_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      student_profiles: {
        Row: {
          coins: number | null
          created_at: string | null
          current_streak: number
          food: number | null
          grade_level_id: string | null
          id: string
          selected_pet_id: string | null
          updated_at: string | null
          xp: number | null
        }
        Insert: {
          coins?: number | null
          created_at?: string | null
          current_streak?: number
          food?: number | null
          grade_level_id?: string | null
          id: string
          selected_pet_id?: string | null
          updated_at?: string | null
          xp?: number | null
        }
        Update: {
          coins?: number | null
          created_at?: string | null
          current_streak?: number
          food?: number | null
          grade_level_id?: string | null
          id?: string
          selected_pet_id?: string | null
          updated_at?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'student_profiles_grade_level_id_fkey'
            columns: ['grade_level_id']
            isOneToOne: false
            referencedRelation: 'grade_levels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_profiles_selected_pet_id_fkey'
            columns: ['selected_pet_id']
            isOneToOne: false
            referencedRelation: 'pets'
            referencedColumns: ['id']
          },
        ]
      }
      student_question_progress: {
        Row: {
          created_at: string
          cycle_number: number
          id: string
          question_id: string
          student_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          cycle_number?: number
          id?: string
          question_id: string
          student_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          cycle_number?: number
          id?: string
          question_id?: string
          student_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'student_question_progress_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'question_statistics'
            referencedColumns: ['question_id']
          },
          {
            foreignKeyName: 'student_question_progress_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_question_progress_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'leaderboard'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_question_progress_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_question_progress_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'sub_topics'
            referencedColumns: ['id']
          },
        ]
      }
      sub_topics: {
        Row: {
          cover_image_path: string | null
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          topic_id: string
          updated_at: string | null
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          topic_id: string
          updated_at?: string | null
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          topic_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sub_topics_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      subjects: {
        Row: {
          cover_image_path: string | null
          created_at: string | null
          display_order: number | null
          grade_level_id: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string | null
          display_order?: number | null
          grade_level_id: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string | null
          display_order?: number | null
          grade_level_id?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subjects_grade_level_id_fkey'
            columns: ['grade_level_id']
            isOneToOne: false
            referencedRelation: 'grade_levels'
            referencedColumns: ['id']
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          id: Database['public']['Enums']['subscription_tier']
          is_highlighted: boolean | null
          name: string
          price_monthly: number
          sessions_per_day: number
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id: Database['public']['Enums']['subscription_tier']
          is_highlighted?: boolean | null
          name: string
          price_monthly: number
          sessions_per_day: number
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: Database['public']['Enums']['subscription_tier']
          is_highlighted?: boolean | null
          name?: string
          price_monthly?: number
          sessions_per_day?: number
        }
        Relationships: []
      }
      topics: {
        Row: {
          cover_image_path: string | null
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          subject_id: string
          updated_at: string | null
        }
        Insert: {
          cover_image_path?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          subject_id: string
          updated_at?: string | null
        }
        Update: {
          cover_image_path?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          subject_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'topics_subject_id_fkey'
            columns: ['subject_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_path: string | null
          current_streak: number | null
          grade_level_name: string | null
          id: string | null
          name: string | null
          rank: number | null
          xp: number | null
        }
        Relationships: []
      }
      question_statistics: {
        Row: {
          attempts: number | null
          avg_time_seconds: number | null
          correct_count: number | null
          correctness_rate: number | null
          question_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_display_streak: {
        Args: { p_student_id: string }
        Returns: number
      }
      complete_practice_session: {
        Args: {
          p_correct_count: number
          p_session_id: string
          p_total_questions: number
        }
        Returns: undefined
      }
      evolve_pet: {
        Args: { p_owned_pet_id: string; p_student_id: string }
        Returns: Json
      }
      feed_pet_for_evolution: {
        Args: {
          p_food_amount: number
          p_owned_pet_id: string
          p_student_id: string
        }
        Returns: Json
      }
      gacha_pull: {
        Args: { p_cost?: number; p_student_id: string }
        Returns: string
      }
      get_question_statistics: {
        Args: never
        Returns: {
          attempts: number
          avg_time_seconds: number
          correct_count: number
          correctness_rate: number
          question_id: string
        }[]
      }
      get_student_streak: { Args: { p_student_id: string }; Returns: number }
      refresh_question_statistics: { Args: never; Returns: undefined }
      update_student_streak: { Args: { p_student_id: string }; Returns: number }
    }
    Enums: {
      feedback_category:
        | 'question_error'
        | 'image_error'
        | 'option_error'
        | 'answer_error'
        | 'explanation_error'
        | 'other'
      invitation_direction: 'parent_to_student' | 'student_to_parent'
      invitation_status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
      mood_type: 'sad' | 'neutral' | 'happy'
      pet_rarity: 'common' | 'rare' | 'epic' | 'legendary'
      question_type: 'mcq' | 'short_answer' | 'mrq'
      subscription_tier: 'basic' | 'plus' | 'pro' | 'max'
      user_type: 'admin' | 'student' | 'parent'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      feedback_category: [
        'question_error',
        'image_error',
        'option_error',
        'answer_error',
        'explanation_error',
        'other',
      ],
      invitation_direction: ['parent_to_student', 'student_to_parent'],
      invitation_status: ['pending', 'accepted', 'rejected', 'cancelled'],
      mood_type: ['sad', 'neutral', 'happy'],
      pet_rarity: ['common', 'rare', 'epic', 'legendary'],
      question_type: ['mcq', 'short_answer', 'mrq'],
      subscription_tier: ['basic', 'plus', 'pro', 'max'],
      user_type: ['admin', 'student', 'parent'],
    },
  },
} as const
