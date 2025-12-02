-- Fix remaining multiple permissive policies by using restrictive admin policies
-- The issue: "FOR ALL" policies include SELECT, causing overlap with public SELECT policies
-- Solution: Change admin policies to only cover INSERT/UPDATE/DELETE (not SELECT)

-- ============================================================================
-- grade_levels
-- ============================================================================
DROP POLICY IF EXISTS "Admins can modify grade levels" ON public.grade_levels;

CREATE POLICY "Admins can insert grade levels" ON public.grade_levels
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can update grade levels" ON public.grade_levels
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can delete grade levels" ON public.grade_levels
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- pets
-- ============================================================================
DROP POLICY IF EXISTS "Admins can modify pets" ON public.pets;

CREATE POLICY "Admins can insert pets" ON public.pets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can update pets" ON public.pets
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can delete pets" ON public.pets
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- subjects
-- ============================================================================
DROP POLICY IF EXISTS "Admins can modify subjects" ON public.subjects;

CREATE POLICY "Admins can insert subjects" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can update subjects" ON public.subjects
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can delete subjects" ON public.subjects
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- subscription_plans
-- ============================================================================
DROP POLICY IF EXISTS "Admins can modify subscription plans" ON public.subscription_plans;

CREATE POLICY "Admins can insert subscription plans" ON public.subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can update subscription plans" ON public.subscription_plans
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can delete subscription plans" ON public.subscription_plans
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

-- ============================================================================
-- topics
-- ============================================================================
DROP POLICY IF EXISTS "Admins can modify topics" ON public.topics;

CREATE POLICY "Admins can insert topics" ON public.topics
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can update topics" ON public.topics
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));

CREATE POLICY "Admins can delete topics" ON public.topics
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid())
    AND profiles.user_type = 'admin'::user_type
  ));
