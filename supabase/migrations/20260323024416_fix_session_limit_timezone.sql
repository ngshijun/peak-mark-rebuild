-- Fix: session limit check in create_practice_session used UTC day bounds
-- while the client uses MYT (Asia/Kuala_Lumpur, UTC+8) day bounds.
-- This caused an 8-hour window (midnight MYT to 8 AM MYT) where the client
-- saw a new day but the server still counted the previous MYT day's sessions.

CREATE OR REPLACE FUNCTION "public"."create_practice_session"(
  "p_student_id" "uuid",
  "p_topic_id" "uuid",
  "p_grade_level_id" "uuid",
  "p_subject_id" "uuid",
  "p_questions" "jsonb",
  "p_cycle_number" integer
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session_id UUID;
  v_total_questions INT;
  v_tier subscription_tier;
  v_max_sessions INT;
  v_sessions_today INT;
  v_myt_day_start TIMESTAMPTZ;
  v_myt_day_end TIMESTAMPTZ;
BEGIN
  -- Calculate total questions from input array
  v_total_questions := jsonb_array_length(p_questions);

  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'Questions array cannot be empty';
  END IF;

  -- Read the student's subscription tier directly from student_profiles
  SELECT sp.subscription_tier INTO v_tier
  FROM student_profiles sp
  WHERE sp.id = p_student_id;

  -- Fallback to 'core' if no profile found (shouldn't happen)
  IF v_tier IS NULL THEN
    v_tier := 'core';
  END IF;

  -- Get the daily session limit for this tier
  SELECT spl.sessions_per_day INTO v_max_sessions
  FROM subscription_plans spl
  WHERE spl.id = v_tier;

  IF v_max_sessions IS NULL THEN
    v_max_sessions := 3; -- safe fallback
  END IF;

  -- Compute MYT (UTC+8) day bounds to match client-side logic
  v_myt_day_start := date_trunc('day', now() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur';
  v_myt_day_end := v_myt_day_start + interval '1 day';

  -- Count sessions the student already started today (MYT day)
  SELECT count(*) INTO v_sessions_today
  FROM practice_sessions ps
  WHERE ps.student_id = p_student_id
    AND ps.created_at >= v_myt_day_start
    AND ps.created_at < v_myt_day_end;

  IF v_sessions_today >= v_max_sessions THEN
    RAISE EXCEPTION 'Daily session limit reached (% of % sessions)', v_sessions_today, v_max_sessions;
  END IF;

  -- Create the practice session
  INSERT INTO practice_sessions (
    student_id,
    topic_id,
    grade_level_id,
    subject_id,
    total_questions,
    current_question_index,
    correct_count
  )
  VALUES (
    p_student_id,
    p_topic_id,
    p_grade_level_id,
    p_subject_id,
    v_total_questions,
    0,
    0
  )
  RETURNING id INTO v_session_id;

  -- Insert session questions (preserves question order)
  INSERT INTO session_questions (session_id, question_id, question_order)
  SELECT
    v_session_id,
    (q->>'question_id')::UUID,
    (q->>'question_order')::INT
  FROM jsonb_array_elements(p_questions) AS q;

  -- Upsert student question progress (track which questions were used)
  INSERT INTO student_question_progress (student_id, topic_id, question_id, cycle_number)
  SELECT
    p_student_id,
    p_topic_id,
    (q->>'question_id')::UUID,
    p_cycle_number
  FROM jsonb_array_elements(p_questions) AS q
  ON CONFLICT (student_id, topic_id, question_id, cycle_number) DO NOTHING;

  RETURN v_session_id;
END;
$$;
