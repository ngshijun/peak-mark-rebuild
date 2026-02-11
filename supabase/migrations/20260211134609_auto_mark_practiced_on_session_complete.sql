-- Trigger function: automatically set has_practiced = TRUE on daily_statuses
-- when a practice_session is completed (completed_at changes from NULL to non-NULL).
-- This ensures has_practiced is only ever set on actual session completion,
-- not when a session is merely started.

CREATE OR REPLACE FUNCTION auto_mark_practiced_on_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_date DATE;
BEGIN
  -- Only fire when completed_at transitions from NULL to a value
  IF NEW.completed_at IS NOT NULL AND (OLD IS NULL OR OLD.completed_at IS NULL) THEN
    v_session_date := (NEW.completed_at AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE;

    -- Upsert daily_statuses: create if missing, set has_practiced = TRUE
    INSERT INTO daily_statuses (student_id, date, has_practiced)
    VALUES (NEW.student_id, v_session_date, TRUE)
    ON CONFLICT (student_id, date)
    DO UPDATE SET has_practiced = TRUE
    WHERE daily_statuses.has_practiced = FALSE;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on practice_sessions
DROP TRIGGER IF EXISTS mark_practiced_on_session_complete ON practice_sessions;
CREATE TRIGGER mark_practiced_on_session_complete
  AFTER INSERT OR UPDATE OF completed_at ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION auto_mark_practiced_on_complete();
