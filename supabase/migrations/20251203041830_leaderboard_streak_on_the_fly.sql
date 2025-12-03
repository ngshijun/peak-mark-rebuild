-- Calculate streak on-the-fly for leaderboard
-- This ensures inactive students show correct streak (0) without needing to log in
-- The stored current_streak in student_profiles is still updated when users log in,
-- but the leaderboard uses calculated values for accuracy.

-- Create a function to calculate streak based on daily_statuses
CREATE OR REPLACE FUNCTION calculate_display_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_last_practiced_date DATE;
  v_streak INTEGER := 0;
  v_check_date DATE;
  v_practiced BOOLEAN;
BEGIN
  -- Get the most recent practice date
  SELECT MAX(date) INTO v_last_practiced_date
  FROM daily_statuses
  WHERE student_id = p_student_id AND has_practiced = true;

  -- If never practiced, streak is 0
  IF v_last_practiced_date IS NULL THEN
    RETURN 0;
  END IF;

  -- If last practice was before yesterday, streak is broken
  IF v_last_practiced_date < CURRENT_DATE - 1 THEN
    RETURN 0;
  END IF;

  -- Count consecutive days starting from last practiced date
  v_check_date := v_last_practiced_date;
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

  RETURN v_streak;
END;
$$;

-- Update the leaderboard view to use calculated streak
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  sp.xp,
  calculate_display_streak(p.id) AS current_streak,
  gl.name AS grade_level_name,
  RANK() OVER (ORDER BY sp.xp DESC) AS rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
WHERE p.user_type = 'student'
ORDER BY sp.xp DESC;
