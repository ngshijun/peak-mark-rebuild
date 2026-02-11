-- ============================================================================
-- Fix streak calculation timezone mismatch
--
-- The daily_statuses.date column stores dates in Asia/Kuala_Lumpur timezone
-- (set by the auto_mark_practiced_on_complete trigger), but the streak
-- functions used CURRENT_DATE which is UTC. Between 12am-8am SGT (when
-- UTC date is the previous day), the streak function would start checking
-- from the wrong date and miss today's practice record entirely.
--
-- Also removes the redundant daily_statuses upsert from
-- complete_practice_session since the auto_mark_practiced_on_complete
-- trigger already handles it correctly with local timezone.
-- ============================================================================

-- Fix update_student_streak: use local timezone instead of CURRENT_DATE
CREATE OR REPLACE FUNCTION public.update_student_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_streak INTEGER := 0;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE;
  v_check_date DATE := v_today;
  v_practiced BOOLEAN;
BEGIN
  -- First check today (local timezone)
  SELECT has_practiced INTO v_practiced
  FROM public.daily_statuses
  WHERE student_id = p_student_id AND date = v_check_date;

  -- If practiced today, start counting from today
  IF v_practiced IS TRUE THEN
    v_streak := 1;
    v_check_date := v_check_date - INTERVAL '1 day';
  ELSE
    -- If not practiced today, check yesterday
    v_check_date := v_check_date - INTERVAL '1 day';
    SELECT has_practiced INTO v_practiced
    FROM public.daily_statuses
    WHERE student_id = p_student_id AND date = v_check_date;

    -- If didn't practice yesterday either, streak is 0
    IF v_practiced IS NOT TRUE THEN
      UPDATE public.student_profiles
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
    FROM public.daily_statuses
    WHERE student_id = p_student_id AND date = v_check_date;

    IF v_practiced IS TRUE THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update the student's current_streak
  UPDATE public.student_profiles
  SET current_streak = v_streak
  WHERE id = p_student_id;

  RETURN v_streak;
END;
$$;

-- Fix calculate_display_streak: use local timezone instead of CURRENT_DATE
CREATE OR REPLACE FUNCTION public.calculate_display_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE;
  v_last_practiced_date DATE;
  v_streak INTEGER := 0;
  v_check_date DATE;
  v_practiced BOOLEAN;
BEGIN
  -- Get the most recent practice date
  SELECT MAX(date) INTO v_last_practiced_date
  FROM public.daily_statuses
  WHERE student_id = p_student_id AND has_practiced = true;

  -- If never practiced, streak is 0
  IF v_last_practiced_date IS NULL THEN
    RETURN 0;
  END IF;

  -- If last practice was before yesterday (local timezone), streak is broken
  IF v_last_practiced_date < v_today - 1 THEN
    RETURN 0;
  END IF;

  -- Count consecutive days starting from last practiced date
  v_check_date := v_last_practiced_date;
  LOOP
    SELECT has_practiced INTO v_practiced
    FROM public.daily_statuses
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

-- Fix complete_practice_session: remove redundant daily_statuses upsert
-- The auto_mark_practiced_on_complete trigger already handles this correctly
-- using local timezone (Asia/Kuala_Lumpur). The CURRENT_DATE-based upsert
-- here used UTC which caused timezone mismatches.
DROP FUNCTION IF EXISTS complete_practice_session(UUID);

CREATE OR REPLACE FUNCTION complete_practice_session(p_session_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_completed_at TIMESTAMPTZ;
  v_correct_count INTEGER;
  v_total_time_seconds INTEGER;
  v_base_xp CONSTANT INTEGER := 25;
  v_bonus_xp_per_correct CONSTANT INTEGER := 15;
  v_base_coins CONSTANT INTEGER := 10;
  v_bonus_coins_per_correct CONSTANT INTEGER := 5;
  v_total_xp INTEGER;
  v_total_coins INTEGER;
BEGIN
  -- Check if session exists and is not already completed
  SELECT student_id, completed_at
  INTO v_student_id, v_completed_at
  FROM practice_sessions
  WHERE id = p_session_id;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Session not found: %', p_session_id;
  END IF;

  IF v_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Session already completed: %', p_session_id;
  END IF;

  -- Count correct answers from actual answer records (not client-supplied)
  SELECT
    COUNT(*) FILTER (WHERE is_correct = TRUE),
    COALESCE(SUM(time_spent_seconds), 0)
  INTO v_correct_count, v_total_time_seconds
  FROM practice_answers
  WHERE session_id = p_session_id;

  -- Calculate rewards server-side
  v_total_xp := v_base_xp + (v_correct_count * v_bonus_xp_per_correct);
  v_total_coins := v_base_coins + (v_correct_count * v_bonus_coins_per_correct);

  -- Update the practice session with completion data
  -- Setting completed_at fires the auto_mark_practiced_on_complete trigger,
  -- which upserts daily_statuses with the correct local timezone date
  -- and cascades to update the student's streak
  UPDATE practice_sessions
  SET
    completed_at = NOW(),
    total_time_seconds = v_total_time_seconds,
    correct_count = v_correct_count,
    xp_earned = v_total_xp,
    coins_earned = v_total_coins
  WHERE id = p_session_id;

  -- Award XP and coins to the student
  UPDATE student_profiles
  SET
    xp = xp + v_total_xp,
    coins = coins + v_total_coins
  WHERE id = v_student_id;

  RETURN jsonb_build_object(
    'xp_earned', v_total_xp,
    'coins_earned', v_total_coins,
    'correct_count', v_correct_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_practice_session(UUID) TO authenticated;
