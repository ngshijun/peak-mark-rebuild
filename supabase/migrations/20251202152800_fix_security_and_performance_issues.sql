-- Migration to fix security and performance issues identified by Supabase advisors
-- Issues addressed:
-- 1. SECURITY DEFINER view (leaderboard) - ERROR level
-- 2. Function search_path mutable - WARN level
-- 3. Materialized view in API (question_statistics) - WARN level
-- 4. Unindexed foreign keys - INFO level
-- 5. RLS policies using auth.uid() instead of (select auth.uid()) - WARN level

-- ============================================================================
-- 1. FIX SECURITY DEFINER VIEW (leaderboard)
-- The view uses SECURITY DEFINER which bypasses RLS. Recreate as SECURITY INVOKER.
-- ============================================================================
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  sp.xp,
  sp.current_streak,
  gl.name AS grade_level_name,
  rank() OVER (ORDER BY sp.xp DESC) AS rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
WHERE p.user_type = 'student'::user_type
ORDER BY sp.xp DESC;

-- ============================================================================
-- 2. FIX FUNCTION SEARCH_PATH MUTABLE
-- Set search_path for all functions to prevent search path injection attacks
-- ============================================================================

-- update_student_streak
CREATE OR REPLACE FUNCTION public.update_student_streak(p_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_streak INTEGER := 0;
  v_current_date DATE := CURRENT_DATE;
  v_practiced BOOLEAN;
BEGIN
  LOOP
    SELECT has_practiced INTO v_practiced
    FROM daily_statuses
    WHERE student_id = p_student_id AND date = v_current_date;

    IF v_practiced IS TRUE THEN
      v_streak := v_streak + 1;
      v_current_date := v_current_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE student_profiles
  SET current_streak = v_streak
  WHERE id = p_student_id;

  RETURN v_streak;
END;
$function$;

-- trigger_update_student_streak
CREATE OR REPLACE FUNCTION public.trigger_update_student_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_student_streak(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM update_student_streak(NEW.student_id);
    RETURN NEW;
  END IF;
END;
$function$;

-- refresh_all_materialized_views
CREATE OR REPLACE FUNCTION public.refresh_all_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
END;
$function$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- populate_question_hierarchy
CREATE OR REPLACE FUNCTION public.populate_question_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM topics t
  JOIN subjects s ON t.subject_id = s.id
  WHERE t.id = NEW.topic_id;
  RETURN NEW;
END;
$function$;

-- populate_session_hierarchy
CREATE OR REPLACE FUNCTION public.populate_session_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM topics t
  JOIN subjects s ON t.subject_id = s.id
  WHERE t.id = NEW.topic_id;
  RETURN NEW;
END;
$function$;

-- complete_practice_session
CREATE OR REPLACE FUNCTION public.complete_practice_session(p_session_id uuid, p_correct_count integer, p_total_questions integer)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_student_id UUID;
  v_base_xp INTEGER := 50;
  v_bonus_xp_per_correct INTEGER := 10;
  v_base_coins INTEGER := 20;
  v_bonus_coins_per_correct INTEGER := 5;
  v_total_xp INTEGER;
  v_total_coins INTEGER;
BEGIN
  SELECT student_id INTO v_student_id FROM practice_sessions WHERE id = p_session_id;

  v_total_xp := v_base_xp + (p_correct_count * v_bonus_xp_per_correct);
  v_total_coins := v_base_coins + (p_correct_count * v_bonus_coins_per_correct);

  UPDATE practice_sessions SET
    completed_at = NOW(),
    correct_count = p_correct_count,
    xp_earned = v_total_xp,
    coins_earned = v_total_coins
  WHERE id = p_session_id;

  UPDATE student_profiles SET
    xp = xp + v_total_xp,
    coins = coins + v_total_coins
  WHERE id = v_student_id;

  INSERT INTO daily_statuses (student_id, date, has_practiced)
  VALUES (v_student_id, CURRENT_DATE, TRUE)
  ON CONFLICT (student_id, date) DO UPDATE SET
    has_practiced = TRUE,
    updated_at = NOW();
END;
$function$;

-- gacha_pull
CREATE OR REPLACE FUNCTION public.gacha_pull(p_student_id uuid, p_cost integer DEFAULT 100)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_current_coins INTEGER;
  v_random_value FLOAT;
  v_selected_pet_id UUID;
  v_rarity pet_rarity;
BEGIN
  SELECT coins INTO v_current_coins FROM student_profiles WHERE id = p_student_id;
  IF v_current_coins < p_cost THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  UPDATE student_profiles SET coins = coins - p_cost WHERE id = p_student_id;

  v_random_value := random();
  IF v_random_value < 0.01 THEN
    v_rarity := 'legendary';
  ELSIF v_random_value < 0.10 THEN
    v_rarity := 'epic';
  ELSIF v_random_value < 0.40 THEN
    v_rarity := 'rare';
  ELSE
    v_rarity := 'common';
  END IF;

  SELECT id INTO v_selected_pet_id FROM pets WHERE rarity = v_rarity ORDER BY random() LIMIT 1;

  INSERT INTO owned_pets (student_id, pet_id, count)
  VALUES (p_student_id, v_selected_pet_id, 1)
  ON CONFLICT (student_id, pet_id) DO UPDATE SET
    count = owned_pets.count + 1,
    updated_at = NOW();

  RETURN v_selected_pet_id;
END;
$function$;

-- get_student_streak
CREATE OR REPLACE FUNCTION public.get_student_streak(p_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_streak INTEGER := 0;
  v_current_date DATE := CURRENT_DATE;
  v_practiced BOOLEAN;
BEGIN
  LOOP
    SELECT has_practiced INTO v_practiced
    FROM daily_statuses
    WHERE student_id = p_student_id AND date = v_current_date;

    IF v_practiced IS TRUE THEN
      v_streak := v_streak + 1;
      v_current_date := v_current_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$function$;

-- refresh_question_statistics
CREATE OR REPLACE FUNCTION public.refresh_question_statistics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
END;
$function$;

-- ============================================================================
-- 3. FIX MATERIALIZED VIEW IN API
-- Revoke direct access from anon/authenticated roles
-- ============================================================================
REVOKE SELECT ON public.question_statistics FROM anon, authenticated;

-- ============================================================================
-- 4. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_owned_pets_pet_id ON public.owned_pets(pet_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_grade_level_id ON public.practice_sessions(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_subject_id ON public.practice_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_feedback_reported_by ON public.question_feedback(reported_by);
CREATE INDEX IF NOT EXISTS idx_student_profiles_selected_pet_id ON public.student_profiles(selected_pet_id);
CREATE INDEX IF NOT EXISTS idx_student_question_progress_question_id ON public.student_question_progress(question_id);
CREATE INDEX IF NOT EXISTS idx_student_question_progress_topic_id ON public.student_question_progress(topic_id);

-- ============================================================================
-- 5. FIX RLS POLICIES - Use (select auth.uid()) instead of auth.uid()
-- This prevents re-evaluation for each row, improving performance
-- ============================================================================

-- profiles table
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- student_profiles table
DROP POLICY IF EXISTS "Students can view own profile" ON public.student_profiles;
CREATE POLICY "Students can view own profile" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can update own profile" ON public.student_profiles;
CREATE POLICY "Students can update own profile" ON public.student_profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can insert own student profile" ON public.student_profiles;
CREATE POLICY "Students can insert own student profile" ON public.student_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked children profiles" ON public.student_profiles;
CREATE POLICY "Parents can view linked children profiles" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_student_links.parent_id = (select auth.uid())
    AND parent_student_links.student_id = student_profiles.id
  ));

DROP POLICY IF EXISTS "Admins can view all student profiles" ON public.student_profiles;
CREATE POLICY "Admins can view all student profiles" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- parent_profiles table
DROP POLICY IF EXISTS "Parents can view own profile" ON public.parent_profiles;
CREATE POLICY "Parents can view own profile" ON public.parent_profiles
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can update own profile" ON public.parent_profiles;
CREATE POLICY "Parents can update own profile" ON public.parent_profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can insert own parent profile" ON public.parent_profiles;
CREATE POLICY "Parents can insert own parent profile" ON public.parent_profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all parent profiles" ON public.parent_profiles;
CREATE POLICY "Admins can view all parent profiles" ON public.parent_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- grade_levels table
DROP POLICY IF EXISTS "Admins can manage grade levels" ON public.grade_levels;
CREATE POLICY "Admins can manage grade levels" ON public.grade_levels
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- subjects table
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;
CREATE POLICY "Admins can manage subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- topics table
DROP POLICY IF EXISTS "Admins can manage topics" ON public.topics;
CREATE POLICY "Admins can manage topics" ON public.topics
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- questions table
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
CREATE POLICY "Admins can insert questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
CREATE POLICY "Admins can update questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;
CREATE POLICY "Admins can delete questions" ON public.questions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- practice_sessions table
DROP POLICY IF EXISTS "Students can view own sessions" ON public.practice_sessions;
CREATE POLICY "Students can view own sessions" ON public.practice_sessions
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can create own sessions" ON public.practice_sessions;
CREATE POLICY "Students can create own sessions" ON public.practice_sessions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can update own sessions" ON public.practice_sessions;
CREATE POLICY "Students can update own sessions" ON public.practice_sessions
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked children sessions" ON public.practice_sessions;
CREATE POLICY "Parents can view linked children sessions" ON public.practice_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_student_links.parent_id = (select auth.uid())
    AND parent_student_links.student_id = practice_sessions.student_id
  ));

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.practice_sessions;
CREATE POLICY "Admins can view all sessions" ON public.practice_sessions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- session_questions table
DROP POLICY IF EXISTS "Students can view own session questions" ON public.session_questions;
CREATE POLICY "Students can view own session questions" ON public.session_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM practice_sessions
    WHERE practice_sessions.id = session_questions.session_id
    AND practice_sessions.student_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Students can create own session questions" ON public.session_questions;
CREATE POLICY "Students can create own session questions" ON public.session_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM practice_sessions
    WHERE practice_sessions.id = session_questions.session_id
    AND practice_sessions.student_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Parents can view linked children session questions" ON public.session_questions;
CREATE POLICY "Parents can view linked children session questions" ON public.session_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM practice_sessions ps
    JOIN parent_student_links psl ON ps.student_id = psl.student_id
    WHERE ps.id = session_questions.session_id
    AND psl.parent_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Admins can view all session questions" ON public.session_questions;
CREATE POLICY "Admins can view all session questions" ON public.session_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- practice_answers table
DROP POLICY IF EXISTS "Students can view own answers" ON public.practice_answers;
CREATE POLICY "Students can view own answers" ON public.practice_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM practice_sessions
    WHERE practice_sessions.id = practice_answers.session_id
    AND practice_sessions.student_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Students can create own answers" ON public.practice_answers;
CREATE POLICY "Students can create own answers" ON public.practice_answers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM practice_sessions
    WHERE practice_sessions.id = practice_answers.session_id
    AND practice_sessions.student_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Students can update own answers" ON public.practice_answers;
CREATE POLICY "Students can update own answers" ON public.practice_answers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM practice_sessions
    WHERE practice_sessions.id = practice_answers.session_id
    AND practice_sessions.student_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Parents can view linked children answers" ON public.practice_answers;
CREATE POLICY "Parents can view linked children answers" ON public.practice_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM practice_sessions ps
    JOIN parent_student_links psl ON ps.student_id = psl.student_id
    WHERE ps.id = practice_answers.session_id
    AND psl.parent_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Admins can view all practice answers" ON public.practice_answers;
CREATE POLICY "Admins can view all practice answers" ON public.practice_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- pets table
DROP POLICY IF EXISTS "Admins can manage pets" ON public.pets;
CREATE POLICY "Admins can manage pets" ON public.pets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- owned_pets table
DROP POLICY IF EXISTS "Students can view own pets" ON public.owned_pets;
CREATE POLICY "Students can view own pets" ON public.owned_pets
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can add own pets" ON public.owned_pets;
CREATE POLICY "Students can add own pets" ON public.owned_pets
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can update own pets" ON public.owned_pets;
CREATE POLICY "Students can update own pets" ON public.owned_pets
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked children pets" ON public.owned_pets;
CREATE POLICY "Parents can view linked children pets" ON public.owned_pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_student_links.parent_id = (select auth.uid())
    AND parent_student_links.student_id = owned_pets.student_id
  ));

-- daily_statuses table
DROP POLICY IF EXISTS "Students can view own daily statuses" ON public.daily_statuses;
CREATE POLICY "Students can view own daily statuses" ON public.daily_statuses
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can create own daily statuses" ON public.daily_statuses;
CREATE POLICY "Students can create own daily statuses" ON public.daily_statuses
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can update own daily statuses" ON public.daily_statuses;
CREATE POLICY "Students can update own daily statuses" ON public.daily_statuses
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked children daily statuses" ON public.daily_statuses;
CREATE POLICY "Parents can view linked children daily statuses" ON public.daily_statuses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_student_links.parent_id = (select auth.uid())
    AND parent_student_links.student_id = daily_statuses.student_id
  ));

DROP POLICY IF EXISTS "Admins can view all daily statuses" ON public.daily_statuses;
CREATE POLICY "Admins can view all daily statuses" ON public.daily_statuses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- parent_student_invitations table
DROP POLICY IF EXISTS "Users can view own invitations" ON public.parent_student_invitations;
CREATE POLICY "Users can view own invitations" ON public.parent_student_invitations
  FOR SELECT TO authenticated
  USING (parent_id = (select auth.uid()) OR student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create invitations" ON public.parent_student_invitations;
CREATE POLICY "Users can create invitations" ON public.parent_student_invitations
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = (select auth.uid()) OR student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own invitations" ON public.parent_student_invitations;
CREATE POLICY "Users can update own invitations" ON public.parent_student_invitations
  FOR UPDATE TO authenticated
  USING (parent_id = (select auth.uid()) OR student_id = (select auth.uid()));

-- parent_student_links table
DROP POLICY IF EXISTS "Users can view own links" ON public.parent_student_links;
CREATE POLICY "Users can view own links" ON public.parent_student_links
  FOR SELECT TO authenticated
  USING (parent_id = (select auth.uid()) OR student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create links when accepting invitation" ON public.parent_student_links;
CREATE POLICY "Users can create links when accepting invitation" ON public.parent_student_links
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = (select auth.uid()) OR student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own links" ON public.parent_student_links;
CREATE POLICY "Users can delete own links" ON public.parent_student_links
  FOR DELETE TO authenticated
  USING (parent_id = (select auth.uid()) OR student_id = (select auth.uid()));

-- subscription_plans table
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage subscription plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- child_subscriptions table
DROP POLICY IF EXISTS "Parents can view child subscriptions" ON public.child_subscriptions;
CREATE POLICY "Parents can view child subscriptions" ON public.child_subscriptions
  FOR SELECT TO authenticated
  USING (parent_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can view own subscription" ON public.child_subscriptions;
CREATE POLICY "Students can view own subscription" ON public.child_subscriptions
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Parents can manage child subscriptions" ON public.child_subscriptions;
CREATE POLICY "Parents can manage child subscriptions" ON public.child_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    parent_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = child_subscriptions.student_id
    )
  );

DROP POLICY IF EXISTS "Parents can update child subscriptions" ON public.child_subscriptions;
CREATE POLICY "Parents can update child subscriptions" ON public.child_subscriptions
  FOR UPDATE TO authenticated
  USING (
    parent_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = child_subscriptions.student_id
    )
  );

DROP POLICY IF EXISTS "Parents can delete child subscriptions" ON public.child_subscriptions;
CREATE POLICY "Parents can delete child subscriptions" ON public.child_subscriptions
  FOR DELETE TO authenticated
  USING (
    parent_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = child_subscriptions.student_id
    )
  );

-- question_feedback table
DROP POLICY IF EXISTS "Users can view own feedback" ON public.question_feedback;
CREATE POLICY "Users can view own feedback" ON public.question_feedback
  FOR SELECT TO authenticated
  USING (reported_by = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all feedback" ON public.question_feedback;
CREATE POLICY "Admins can view all feedback" ON public.question_feedback
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

DROP POLICY IF EXISTS "Authenticated users can create feedback" ON public.question_feedback;
CREATE POLICY "Authenticated users can create feedback" ON public.question_feedback
  FOR INSERT TO authenticated
  WITH CHECK (reported_by = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update feedback" ON public.question_feedback;
CREATE POLICY "Admins can update feedback" ON public.question_feedback
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

DROP POLICY IF EXISTS "Admins can delete feedback" ON public.question_feedback;
CREATE POLICY "Admins can delete feedback" ON public.question_feedback
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- student_question_progress table
DROP POLICY IF EXISTS "Students can read own question progress" ON public.student_question_progress;
CREATE POLICY "Students can read own question progress" ON public.student_question_progress
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "Students can insert own question progress" ON public.student_question_progress;
CREATE POLICY "Students can insert own question progress" ON public.student_question_progress
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));
