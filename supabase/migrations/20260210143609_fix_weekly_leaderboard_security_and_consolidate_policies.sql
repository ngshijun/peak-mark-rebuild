-- =============================================================================
-- 1. SECURITY: Replace SECURITY DEFINER view with scoped function + safe view
-- =============================================================================
-- The weekly_leaderboard view needs to aggregate practice_sessions across all
-- students, but practice_sessions RLS restricts students to their own rows.
-- Instead of making the entire view SECURITY DEFINER (privilege escalation risk),
-- isolate the privileged aggregation in a minimal SECURITY DEFINER function
-- that only returns non-sensitive aggregated data.

-- Create SECURITY DEFINER function for the privileged aggregation
CREATE OR REPLACE FUNCTION public._weekly_leaderboard_data()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_path text,
  weekly_xp integer,
  total_xp integer,
  grade_level_name text,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.name,
    p.avatar_path,
    COALESCE(SUM(ps.xp_earned), 0)::integer AS weekly_xp,
    sp.xp AS total_xp,
    gl.name AS grade_level_name,
    RANK() OVER (ORDER BY COALESCE(SUM(ps.xp_earned), 0) DESC) AS rank
  FROM profiles p
  JOIN student_profiles sp ON p.id = sp.id
  LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
  LEFT JOIN practice_sessions ps
    ON ps.student_id = p.id
    AND ps.completed_at IS NOT NULL
    AND ps.completed_at >= (date_trunc('week', NOW() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur')
  WHERE p.user_type = 'student'
  GROUP BY p.id, p.name, p.avatar_path, sp.xp, gl.name
  HAVING COALESCE(SUM(ps.xp_earned), 0) > 0
  ORDER BY weekly_xp DESC;
$$;

-- Restrict function access to authenticated users only
REVOKE EXECUTE ON FUNCTION public._weekly_leaderboard_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._weekly_leaderboard_data() TO authenticated;

-- Recreate view as security_invoker=true, wrapping the function
DROP VIEW IF EXISTS public.weekly_leaderboard;
CREATE VIEW public.weekly_leaderboard
  WITH (security_invoker = true)
AS SELECT * FROM public._weekly_leaderboard_data();

GRANT SELECT ON public.weekly_leaderboard TO authenticated;
GRANT SELECT ON public.weekly_leaderboard TO anon;

-- =============================================================================
-- 2. PERFORMANCE: Consolidate multiple permissive SELECT policies
-- =============================================================================
-- Multiple permissive policies on the same role+action are OR'd together,
-- meaning every policy must be evaluated per query. Merging into a single
-- policy with OR conditions is more efficient.

-- child_subscriptions: merge admin + user SELECT policies
DROP POLICY IF EXISTS "Admins can view all child subscriptions" ON public.child_subscriptions;
DROP POLICY IF EXISTS "Users can view relevant subscriptions" ON public.child_subscriptions;

CREATE POLICY "Users can view relevant subscriptions" ON public.child_subscriptions
FOR SELECT TO authenticated
USING (
  parent_id = (SELECT auth.uid())
  OR student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.user_type = 'admin'
  )
);

-- parent_student_links: merge admin + user SELECT policies
DROP POLICY IF EXISTS "Admins can view all parent student links" ON public.parent_student_links;
DROP POLICY IF EXISTS "Users can view own links" ON public.parent_student_links;

CREATE POLICY "Users can view own links" ON public.parent_student_links
FOR SELECT TO authenticated
USING (
  parent_id = (SELECT auth.uid())
  OR student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.user_type = 'admin'
  )
);
