-- ============================================================================
-- Restrict question_statistics to admin users only
-- ============================================================================

-- Revoke direct access from authenticated role
REVOKE ALL ON public.question_statistics FROM authenticated;

-- Create a security-definer function that checks if user is admin
CREATE OR REPLACE FUNCTION public.get_question_statistics()
RETURNS TABLE (
  question_id UUID,
  attempts BIGINT,
  correct_count BIGINT,
  correctness_rate NUMERIC,
  avg_time_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_type TEXT;
BEGIN
  -- Check if the current user is an admin
  SELECT p.user_type INTO v_user_type
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_user_type != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Return all statistics for admin users
  RETURN QUERY
  SELECT
    qs.question_id,
    qs.attempts,
    qs.correct_count,
    qs.correctness_rate,
    qs.avg_time_seconds
  FROM public.question_statistics qs;
END;
$$;

-- Grant execute permission to authenticated users (function will check if admin)
GRANT EXECUTE ON FUNCTION public.get_question_statistics() TO authenticated;

-- ============================================================================
-- Remove duplicate refresh function
-- refresh_all_materialized_views is identical to refresh_question_statistics
-- ============================================================================
DROP FUNCTION IF EXISTS public.refresh_all_materialized_views();
