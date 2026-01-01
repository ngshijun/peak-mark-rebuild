-- Migration: Create atomic functions for multi-table operations
-- This ensures data consistency by wrapping related operations in transactions

-- Drop existing functions if they exist (for clean re-application)
DROP FUNCTION IF EXISTS create_practice_session(UUID, UUID, UUID, UUID, JSONB, INT);
DROP FUNCTION IF EXISTS complete_practice_session(UUID, INT, INT, INT);
DROP FUNCTION IF EXISTS accept_parent_student_invitation(UUID, UUID, BOOLEAN);

-- ============================================================================
-- Function 1: create_practice_session
-- Atomically creates a practice session with its questions and progress records
-- ============================================================================
CREATE OR REPLACE FUNCTION create_practice_session(
  p_student_id UUID,
  p_topic_id UUID,
  p_grade_level_id UUID,
  p_subject_id UUID,
  p_questions JSONB,  -- Array of {question_id, question_order}
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
BEGIN
  -- Calculate total questions from input array
  v_total_questions := jsonb_array_length(p_questions);

  IF v_total_questions = 0 THEN
    RAISE EXCEPTION 'Questions array cannot be empty';
  END IF;

  -- Step 1: Create the practice session
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

  -- Step 2: Insert session questions (preserves question order)
  INSERT INTO session_questions (session_id, question_id, question_order)
  SELECT
    v_session_id,
    (q->>'question_id')::UUID,
    (q->>'question_order')::INT
  FROM jsonb_array_elements(p_questions) AS q;

  -- Step 3: Upsert student question progress (track which questions were used)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_practice_session(UUID, UUID, UUID, UUID, JSONB, INT) TO authenticated;


-- ============================================================================
-- Function 2: complete_practice_session
-- Atomically completes a session and awards XP/coins to the student
-- ============================================================================
CREATE OR REPLACE FUNCTION complete_practice_session(
  p_session_id UUID,
  p_total_time_seconds INT,
  p_xp_earned INT,
  p_coins_earned INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_completed_at TIMESTAMPTZ;
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

  -- Step 1: Update the practice session with completion data
  UPDATE practice_sessions
  SET
    completed_at = NOW(),
    total_time_seconds = p_total_time_seconds,
    xp_earned = p_xp_earned,
    coins_earned = p_coins_earned
  WHERE id = p_session_id;

  -- Step 2: Award XP and coins to the student
  UPDATE student_profiles
  SET
    xp = xp + p_xp_earned,
    coins = coins + p_coins_earned
  WHERE id = v_student_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_practice_session(UUID, INT, INT, INT) TO authenticated;


-- ============================================================================
-- Function 3: accept_parent_student_invitation
-- Atomically accepts an invitation and creates the parent-student link
-- Returns the new link data along with profile information for UI updates
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_parent_student_invitation(
  p_invitation_id UUID,
  p_accepting_user_id UUID,
  p_is_parent BOOLEAN  -- true if parent is accepting, false if student is accepting
)
RETURNS TABLE (
  link_id UUID,
  parent_id UUID,
  student_id UUID,
  linked_at TIMESTAMPTZ,
  -- Parent profile info
  parent_name TEXT,
  parent_email TEXT,
  -- Student profile info
  student_name TEXT,
  student_email TEXT,
  student_avatar_path TEXT,
  student_grade_level_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_link_id UUID;
  v_linked_at TIMESTAMPTZ;
  v_parent_id UUID;
  v_student_id UUID;
BEGIN
  -- Get and validate the invitation
  SELECT * INTO v_invitation
  FROM parent_student_invitations
  WHERE id = p_invitation_id;

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invitation not found: %', p_invitation_id;
  END IF;

  IF v_invitation.status != 'pending' THEN
    RAISE EXCEPTION 'Invitation is not pending: %', v_invitation.status;
  END IF;

  -- Determine parent_id and student_id based on who is accepting
  IF p_is_parent THEN
    v_parent_id := p_accepting_user_id;
    v_student_id := v_invitation.student_id;

    IF v_student_id IS NULL THEN
      RAISE EXCEPTION 'Student ID not found in invitation';
    END IF;
  ELSE
    v_parent_id := v_invitation.parent_id;
    v_student_id := p_accepting_user_id;

    IF v_parent_id IS NULL THEN
      RAISE EXCEPTION 'Parent ID not found in invitation';
    END IF;
  END IF;

  -- Step 1: Update the invitation status
  UPDATE parent_student_invitations
  SET
    status = 'accepted',
    responded_at = NOW(),
    parent_id = v_parent_id,
    student_id = v_student_id
  WHERE id = p_invitation_id;

  -- Step 2: Create the parent-student link
  INSERT INTO parent_student_links (parent_id, student_id)
  VALUES (v_parent_id, v_student_id)
  RETURNING id, linked_at INTO v_link_id, v_linked_at;

  -- Step 3: Return the link data with profile information
  RETURN QUERY
  SELECT
    v_link_id AS link_id,
    v_parent_id AS parent_id,
    v_student_id AS student_id,
    v_linked_at AS linked_at,
    -- Parent profile
    p.name AS parent_name,
    p.email AS parent_email,
    -- Student profile
    sp_profile.name AS student_name,
    sp_profile.email AS student_email,
    sp_profile.avatar_path AS student_avatar_path,
    gl.name AS student_grade_level_name
  FROM profiles p
  CROSS JOIN profiles sp_profile
  LEFT JOIN student_profiles sp ON sp.id = v_student_id
  LEFT JOIN grade_levels gl ON gl.id = sp.grade_level_id
  WHERE p.id = v_parent_id
    AND sp_profile.id = v_student_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_parent_student_invitation(UUID, UUID, BOOLEAN) TO authenticated;
