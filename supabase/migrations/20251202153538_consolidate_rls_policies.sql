-- Migration to consolidate multiple permissive RLS policies into single policies
-- This improves performance by reducing the number of policies evaluated per query

-- ============================================================================
-- child_subscriptions - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Parents can view child subscriptions" ON public.child_subscriptions;
DROP POLICY IF EXISTS "Students can view own subscription" ON public.child_subscriptions;

CREATE POLICY "Users can view relevant subscriptions" ON public.child_subscriptions
  FOR SELECT TO authenticated
  USING (
    parent_id = (select auth.uid())
    OR student_id = (select auth.uid())
  );

-- ============================================================================
-- daily_statuses - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own daily statuses" ON public.daily_statuses;
DROP POLICY IF EXISTS "Parents can view linked children daily statuses" ON public.daily_statuses;
DROP POLICY IF EXISTS "Admins can view all daily statuses" ON public.daily_statuses;

CREATE POLICY "Users can view relevant daily statuses" ON public.daily_statuses
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = daily_statuses.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- grade_levels - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Curriculum is viewable by everyone" ON public.grade_levels;
DROP POLICY IF EXISTS "Admins can manage grade levels" ON public.grade_levels;

-- Everyone can view, only admins can modify
CREATE POLICY "Grade levels are viewable by everyone" ON public.grade_levels
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify grade levels" ON public.grade_levels
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- owned_pets - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own pets" ON public.owned_pets;
DROP POLICY IF EXISTS "Parents can view linked children pets" ON public.owned_pets;

CREATE POLICY "Users can view relevant pets" ON public.owned_pets
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = owned_pets.student_id
    )
  );

-- ============================================================================
-- parent_profiles - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Parents can view own profile" ON public.parent_profiles;
DROP POLICY IF EXISTS "Admins can view all parent profiles" ON public.parent_profiles;

CREATE POLICY "Users can view relevant parent profiles" ON public.parent_profiles
  FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- pets - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Pets are viewable by everyone" ON public.pets;
DROP POLICY IF EXISTS "Admins can manage pets" ON public.pets;

-- Everyone can view, only admins can modify
CREATE POLICY "Pets are viewable by everyone" ON public.pets
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify pets" ON public.pets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- practice_answers - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own answers" ON public.practice_answers;
DROP POLICY IF EXISTS "Parents can view linked children answers" ON public.practice_answers;
DROP POLICY IF EXISTS "Admins can view all practice answers" ON public.practice_answers;

CREATE POLICY "Users can view relevant practice answers" ON public.practice_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_answers.session_id
      AND practice_sessions.student_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM practice_sessions ps
      JOIN parent_student_links psl ON ps.student_id = psl.student_id
      WHERE ps.id = practice_answers.session_id
      AND psl.parent_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- practice_sessions - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Parents can view linked children sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.practice_sessions;

CREATE POLICY "Users can view relevant practice sessions" ON public.practice_sessions
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = practice_sessions.student_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- question_feedback - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own feedback" ON public.question_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.question_feedback;

CREATE POLICY "Users can view relevant feedback" ON public.question_feedback
  FOR SELECT TO authenticated
  USING (
    reported_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- session_questions - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own session questions" ON public.session_questions;
DROP POLICY IF EXISTS "Parents can view linked children session questions" ON public.session_questions;
DROP POLICY IF EXISTS "Admins can view all session questions" ON public.session_questions;

CREATE POLICY "Users can view relevant session questions" ON public.session_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = session_questions.session_id
      AND practice_sessions.student_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM practice_sessions ps
      JOIN parent_student_links psl ON ps.student_id = psl.student_id
      WHERE ps.id = session_questions.session_id
      AND psl.parent_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- student_profiles - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Students can view own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Parents can view linked children profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Admins can view all student profiles" ON public.student_profiles;

CREATE POLICY "Users can view relevant student profiles" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (select auth.uid())
      AND parent_student_links.student_id = student_profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- ============================================================================
-- subjects - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Subjects are viewable by everyone" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

-- Everyone can view, only admins can modify
CREATE POLICY "Subjects are viewable by everyone" ON public.subjects
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- subscription_plans - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Subscription plans are viewable by everyone" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON public.subscription_plans;

-- Everyone can view, only admins can modify
CREATE POLICY "Subscription plans are viewable by everyone" ON public.subscription_plans
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify subscription plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- topics - Consolidate SELECT policies
-- ============================================================================
DROP POLICY IF EXISTS "Topics are viewable by everyone" ON public.topics;
DROP POLICY IF EXISTS "Admins can manage topics" ON public.topics;

-- Everyone can view, only admins can modify
CREATE POLICY "Topics are viewable by everyone" ON public.topics
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify topics" ON public.topics
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));
