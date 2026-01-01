-- Migration: Create atomic function for spin wheel reward
-- This ensures the spin is recorded AND coins are credited atomically

CREATE OR REPLACE FUNCTION record_spin_reward(
  p_daily_status_id UUID,
  p_student_id UUID,
  p_reward INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_spun BOOLEAN;
BEGIN
  -- Check if already spun today
  SELECT has_spun INTO v_has_spun
  FROM daily_statuses
  WHERE id = p_daily_status_id AND student_id = p_student_id;

  IF v_has_spun IS NULL THEN
    RAISE EXCEPTION 'Daily status not found for student';
  END IF;

  IF v_has_spun = TRUE THEN
    RAISE EXCEPTION 'Already spun today';
  END IF;

  IF p_reward <= 0 THEN
    RAISE EXCEPTION 'Reward must be positive';
  END IF;

  -- Step 1: Update daily status with spin info
  UPDATE daily_statuses
  SET
    has_spun = TRUE,
    spin_reward = p_reward
  WHERE id = p_daily_status_id
    AND student_id = p_student_id;

  -- Step 2: Credit coins to student profile
  UPDATE student_profiles
  SET coins = coins + p_reward
  WHERE id = p_student_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION record_spin_reward(UUID, UUID, INT) TO authenticated;
