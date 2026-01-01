-- RPC function to atomically mark daily status as practiced and return updated streak
-- The existing trigger handles streak calculation, this function provides a clean interface
-- that returns the streak value in the same transaction

CREATE OR REPLACE FUNCTION mark_daily_practiced(
  p_daily_status_id UUID,
  p_student_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_practiced BOOLEAN;
  v_new_streak INTEGER;
BEGIN
  -- Check if already practiced (idempotent operation)
  SELECT has_practiced INTO v_already_practiced
  FROM daily_statuses
  WHERE id = p_daily_status_id AND student_id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily status not found or does not belong to student';
  END IF;

  -- If already practiced, just return current streak
  IF v_already_practiced THEN
    SELECT current_streak INTO v_new_streak
    FROM student_profiles
    WHERE id = p_student_id;

    RETURN COALESCE(v_new_streak, 0);
  END IF;

  -- Update has_practiced - this triggers update_streak_trigger
  -- which calls trigger_update_student_streak() -> update_student_streak()
  UPDATE daily_statuses
  SET has_practiced = TRUE
  WHERE id = p_daily_status_id AND student_id = p_student_id;

  -- The trigger has now updated student_profiles.current_streak
  -- Fetch and return the new streak value
  SELECT current_streak INTO v_new_streak
  FROM student_profiles
  WHERE id = p_student_id;

  RETURN COALESCE(v_new_streak, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_daily_practiced(UUID, UUID) TO authenticated;
