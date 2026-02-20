-- Add current_streak to weekly leaderboard, matching the all-time leaderboard.
-- Uses calculate_display_streak() (SECURITY DEFINER) to compute streak on the fly.

-- Must drop view first since it depends on the function's return type
DROP VIEW IF EXISTS public.weekly_leaderboard;
DROP FUNCTION IF EXISTS public._weekly_leaderboard_data();

-- 1. Recreate the data function with current_streak column
CREATE FUNCTION public._weekly_leaderboard_data()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_path text,
  weekly_xp integer,
  total_xp integer,
  grade_level_name text,
  rank bigint,
  current_streak integer
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
    RANK() OVER (ORDER BY COALESCE(SUM(ps.xp_earned), 0) DESC) AS rank,
    public.calculate_display_streak(p.id) AS current_streak
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

-- 2. Recreate the view (picks up new column automatically)
DROP VIEW IF EXISTS public.weekly_leaderboard;
CREATE VIEW public.weekly_leaderboard
  WITH (security_invoker = true)
AS SELECT * FROM public._weekly_leaderboard_data();

GRANT SELECT ON public.weekly_leaderboard TO authenticated;
GRANT SELECT ON public.weekly_leaderboard TO anon;
