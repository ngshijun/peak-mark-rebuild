-- Update economy rewards for practice sessions
-- Changes:
--   Base XP: 50 → 25
--   Bonus XP per correct: 10 → 15
--   Base coins: 20 → 10
--   Bonus coins per correct: 5 → 5 (unchanged)
--
-- New rewards (10 questions):
--   10/10: 175 XP, 60 coins (was 150 XP, 70 coins)
--   7/10:  130 XP, 45 coins (was 120 XP, 55 coins)
--   5/10:  100 XP, 35 coins (was 100 XP, 45 coins)
--   0/10:  25 XP, 10 coins (was 50 XP, 20 coins)
--
-- Performance ratio increased from 3x to 7x

CREATE OR REPLACE FUNCTION public.complete_practice_session(p_session_id uuid, p_correct_count integer, p_total_questions integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_student_id UUID;
  v_base_xp INTEGER := 25;              -- was 50
  v_bonus_xp_per_correct INTEGER := 15; -- was 10
  v_base_coins INTEGER := 10;           -- was 20
  v_bonus_coins_per_correct INTEGER := 5;
  v_total_xp INTEGER;
  v_total_coins INTEGER;
BEGIN
  SELECT student_id INTO v_student_id FROM practice_sessions WHERE id = p_session_id;

  v_total_xp := v_base_xp + (p_correct_count * v_bonus_xp_per_correct);
  v_total_coins := v_base_coins + (p_correct_count * v_bonus_coins_per_correct);

  UPDATE practice_sessions SET
    completed_at = NOW(),
    correct_count = p_correct_count,
    xp_earned = v_total_xp,
    coins_earned = v_total_coins
  WHERE id = p_session_id;

  UPDATE student_profiles SET
    xp = xp + v_total_xp,
    coins = coins + v_total_coins
  WHERE id = v_student_id;

  INSERT INTO daily_statuses (student_id, date, has_practiced)
  VALUES (v_student_id, CURRENT_DATE, TRUE)
  ON CONFLICT (student_id, date) DO UPDATE SET
    has_practiced = TRUE,
    updated_at = NOW();
END;
$function$;
