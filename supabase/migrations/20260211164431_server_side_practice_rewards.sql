-- ============================================================================
-- Move practice session reward calculation to server-side
--
-- Previously, the client calculated XP/coins and passed them to the RPC.
-- A malicious client could send inflated values. Now the server counts
-- correct answers from practice_answers and computes rewards itself.
--
-- Also restores the intended reward formula from migration 20251221110319
-- that was accidentally overwritten by migration 20260101141933:
--   Base XP:  25  (client had 50)
--   Bonus XP: 15 per correct (client had 10)
--   Base coins:  10  (client had 20)
--   Bonus coins: 5 per correct (unchanged)
--
-- Rewards (10 questions):
--   10/10: 175 XP, 60 coins
--   7/10:  130 XP, 45 coins
--   5/10:  100 XP, 35 coins
--   0/10:  25 XP, 10 coins
-- ============================================================================

-- Drop both old overloaded signatures
DROP FUNCTION IF EXISTS complete_practice_session(uuid, integer, integer);
DROP FUNCTION IF EXISTS complete_practice_session(uuid, integer, integer, integer);

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

  -- Upsert daily status (triggers streak update automatically)
  INSERT INTO daily_statuses (student_id, date, has_practiced)
  VALUES (v_student_id, CURRENT_DATE, TRUE)
  ON CONFLICT (student_id, date) DO UPDATE SET
    has_practiced = TRUE,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'xp_earned', v_total_xp,
    'coins_earned', v_total_coins,
    'correct_count', v_correct_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION complete_practice_session(UUID) TO authenticated;
