-- Migration: Fix Security and Performance Issues
-- This migration addresses the following:
-- 1. SECURITY: Set search_path on functions to prevent search_path manipulation attacks
-- 2. PERFORMANCE: Optimize RLS policies to use (select auth.uid()) pattern to avoid per-row re-evaluation
-- 3. PERFORMANCE: Consolidate multiple permissive policies into single policies

-- ============================================================================
-- 1. FIX FUNCTION SEARCH_PATH SECURITY ISSUES
-- ============================================================================

-- Fix populate_question_hierarchy function
CREATE OR REPLACE FUNCTION public.populate_question_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM public.sub_topics st
  JOIN public.topics t ON st.topic_id = t.id
  JOIN public.subjects s ON t.subject_id = s.id
  WHERE st.id = NEW.topic_id;
  RETURN NEW;
END;
$function$;

-- Fix populate_session_hierarchy function
CREATE OR REPLACE FUNCTION public.populate_session_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM public.sub_topics st
  JOIN public.topics t ON st.topic_id = t.id
  JOIN public.subjects s ON t.subject_id = s.id
  WHERE st.id = NEW.topic_id;
  RETURN NEW;
END;
$function$;

-- Fix update_questions_updated_at function
CREATE OR REPLACE FUNCTION public.update_questions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 2. FIX RLS PERFORMANCE ISSUES AND CONSOLIDATE POLICIES ON TOPICS TABLE
-- ============================================================================

-- Drop existing policies on topics table
DROP POLICY IF EXISTS "Allow admin full access to topics" ON public.topics;
DROP POLICY IF EXISTS "Allow public read access to topics" ON public.topics;

-- Create single read policy for everyone (optimized - no auth function call needed since it's true)
CREATE POLICY "Allow public read access to topics"
ON public.topics
FOR SELECT
TO public
USING (true);

-- Create separate policies for admin write operations (optimized with select wrapper)
CREATE POLICY "Allow admin insert on topics"
ON public.topics
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'::user_type
  )
);

CREATE POLICY "Allow admin update on topics"
ON public.topics
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'::user_type
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'::user_type
  )
);

CREATE POLICY "Allow admin delete on topics"
ON public.topics
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'::user_type
  )
);

-- ============================================================================
-- 3. FIX RLS PERFORMANCE ISSUES AND CONSOLIDATE POLICIES ON PAYMENT_HISTORY TABLE
-- ============================================================================

-- Drop existing policies on payment_history table
DROP POLICY IF EXISTS "Admins can view all payment history" ON public.payment_history;
DROP POLICY IF EXISTS "Parents can view own payment history" ON public.payment_history;

-- Create single consolidated SELECT policy (optimized with select wrapper)
-- Admins can view all, parents can view their own
CREATE POLICY "Allow payment history read access"
ON public.payment_history
FOR SELECT
TO public
USING (
  -- Parents can view their own payment history
  parent_id = (SELECT auth.uid())
  OR
  -- Admins can view all payment history
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'::user_type
  )
);
