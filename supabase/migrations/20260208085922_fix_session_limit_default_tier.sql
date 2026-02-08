-- Fix: default tier should be 'core' not 'basic' (was renamed in earlier migration)

CREATE OR REPLACE FUNCTION create_practice_session(
  p_student_id UUID,
  p_topic_id UUID,
  p_grade_level_id UUID,
  p_subject_id UUID,
  p_questions JSONB,
  p_cycle_number INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_total_questions INT;
  v_tier subscription_tier;
  v_max_sessions INT;
  v_sessions_today INT;
BEGIN
  -- Calculate total questions from input array
  v_total_questions := jsonb_array_length(p_questions);

  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'Questions array cannot be empty';
  END IF;

  -- Resolve the student's subscription tier (default to 'core')
  SELECT cs.tier INTO v_tier
  FROM child_subscriptions cs
  WHERE cs.student_id = p_student_id
    AND cs.is_active = true
  ORDER BY cs.updated_at DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    v_tier := 'core';
  END IF;

  -- Get the daily session limit for this tier
  SELECT sp.sessions_per_day INTO v_max_sessions
  FROM subscription_plans sp
  WHERE sp.id = v_tier;

  IF v_max_sessions IS NULL THEN
    v_max_sessions := 3; -- safe fallback
  END IF;

  -- Count sessions the student already started today (UTC day)
  SELECT count(*) INTO v_sessions_today
  FROM practice_sessions ps
  WHERE ps.student_id = p_student_id
    AND ps.created_at >= date_trunc('day', now())
    AND ps.created_at < date_trunc('day', now()) + interval '1 day';

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
