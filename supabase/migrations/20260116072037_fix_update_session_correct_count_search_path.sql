-- Migration: Fix security issue with update_session_correct_count function
-- Issue: Function has mutable search_path which can be exploited for SQL injection attacks
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- Recreate the function with SET search_path = public
CREATE OR REPLACE FUNCTION public.update_session_correct_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only increment if the answer is correct
  IF NEW.is_correct THEN
    UPDATE public.practice_sessions
    SET correct_count = correct_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update comment for documentation
COMMENT ON FUNCTION public.update_session_correct_count() IS
  'Automatically increments practice_sessions.correct_count when a correct answer is inserted. Search path set to public for security.';
