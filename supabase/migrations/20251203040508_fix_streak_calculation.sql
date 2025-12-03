-- Fix update_student_streak function to allow "practiced yesterday but not today yet"
-- Previously, the function would return 0 if the user hadn't practiced today,
-- even if they practiced yesterday. The streak should only reset if they missed yesterday.

CREATE OR REPLACE FUNCTION update_student_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak INTEGER := 0;
  v_check_date DATE := CURRENT_DATE;
  v_practiced BOOLEAN;
BEGIN
  -- First check today
  SELECT has_practiced INTO v_practiced
  FROM daily_statuses
  WHERE student_id = p_student_id AND date = v_check_date;

  -- If practiced today, start counting from today
  IF v_practiced IS TRUE THEN
    v_streak := 1;
    v_check_date := v_check_date - INTERVAL '1 day';
  ELSE
    -- If not practiced today, check yesterday
    v_check_date := v_check_date - INTERVAL '1 day';
    SELECT has_practiced INTO v_practiced
    FROM daily_statuses
    WHERE student_id = p_student_id AND date = v_check_date;

    -- If didn't practice yesterday either, streak is 0
    IF v_practiced IS NOT TRUE THEN
      UPDATE student_profiles
      SET current_streak = 0
      WHERE id = p_student_id;
      RETURN 0;
    END IF;

    -- Practiced yesterday, start counting from yesterday
    v_streak := 1;
    v_check_date := v_check_date - INTERVAL '1 day';
  END IF;

  -- Continue counting consecutive days backwards
  LOOP
    SELECT has_practiced INTO v_practiced
    FROM daily_statuses
    WHERE student_id = p_student_id AND date = v_check_date;

    IF v_practiced IS TRUE THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update the student's current_streak
  UPDATE student_profiles
  SET current_streak = v_streak
  WHERE id = p_student_id;

  RETURN v_streak;
END;
$$;
