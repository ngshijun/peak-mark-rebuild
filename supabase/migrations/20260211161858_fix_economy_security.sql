-- ============================================================================
-- Fix 1: Validate spin wheel reward amounts
-- Previously only checked p_reward > 0, allowing any positive amount
-- ============================================================================

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
  -- Validate reward is one of the valid spin wheel amounts
  IF p_reward NOT IN (5, 10, 15) THEN
    RAISE EXCEPTION 'Invalid reward amount. Must be 5, 10, or 15.';
  END IF;

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

-- ============================================================================
-- Fix 2: Restrict direct column updates on student_profiles
-- Students should only be able to directly update grade_level_id and
-- selected_pet_id. All currency mutations (coins, xp, food) must go through
-- SECURITY DEFINER functions.
-- ============================================================================

-- 2a: Restrict column-level UPDATE permissions
REVOKE UPDATE ON student_profiles FROM authenticated;
GRANT UPDATE (grade_level_id, selected_pet_id) ON student_profiles TO authenticated;

-- 2b: Secure gacha_pull - use auth.uid() instead of client-supplied student_id
-- Drop old function signature that accepted (uuid, integer)
DROP FUNCTION IF EXISTS gacha_pull(uuid, integer);

CREATE OR REPLACE FUNCTION gacha_pull()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_current_coins INTEGER;
  v_cost CONSTANT INTEGER := 100;
  v_random_value FLOAT;
  v_selected_pet_id UUID;
  v_rarity pet_rarity;
BEGIN
  v_student_id := (SELECT auth.uid());
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check coins
  SELECT coins INTO v_current_coins FROM student_profiles WHERE id = v_student_id;
  IF v_current_coins IS NULL THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;
  IF v_current_coins < v_cost THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  -- Deduct coins
  UPDATE student_profiles SET coins = coins - v_cost WHERE id = v_student_id;

  -- Determine rarity (60% common, 30% rare, 9% epic, 1% legendary)
  v_random_value := random();
  IF v_random_value < 0.01 THEN
    v_rarity := 'legendary';
  ELSIF v_random_value < 0.10 THEN
    v_rarity := 'epic';
  ELSIF v_random_value < 0.40 THEN
    v_rarity := 'rare';
  ELSE
    v_rarity := 'common';
  END IF;

  -- Select random pet of that rarity
  SELECT id INTO v_selected_pet_id FROM pets WHERE rarity = v_rarity ORDER BY random() LIMIT 1;

  -- Add to owned pets (or increment count)
  INSERT INTO owned_pets (student_id, pet_id, count)
  VALUES (v_student_id, v_selected_pet_id, 1)
  ON CONFLICT (student_id, pet_id) DO UPDATE SET
    count = owned_pets.count + 1,
    updated_at = NOW();

  RETURN v_selected_pet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION gacha_pull() TO authenticated;

-- 2c: Create gacha_multi_pull for 10x pulls
CREATE OR REPLACE FUNCTION gacha_multi_pull()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_current_coins INTEGER;
  v_cost CONSTANT INTEGER := 900;
  v_result uuid[] := '{}';
  v_pet_id UUID;
  v_random_value FLOAT;
  v_rarity pet_rarity;
  i INTEGER;
BEGIN
  v_student_id := (SELECT auth.uid());
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT coins INTO v_current_coins FROM student_profiles WHERE id = v_student_id;
  IF v_current_coins IS NULL THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;
  IF v_current_coins < v_cost THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  -- Deduct coins (900 for 10x = 10% discount)
  UPDATE student_profiles SET coins = coins - v_cost WHERE id = v_student_id;

  -- Pull 10 pets
  FOR i IN 1..10 LOOP
    v_random_value := random();
    IF v_random_value < 0.01 THEN
      v_rarity := 'legendary';
    ELSIF v_random_value < 0.10 THEN
      v_rarity := 'epic';
    ELSIF v_random_value < 0.40 THEN
      v_rarity := 'rare';
    ELSE
      v_rarity := 'common';
    END IF;

    SELECT id INTO v_pet_id FROM pets WHERE rarity = v_rarity ORDER BY random() LIMIT 1;
    v_result := v_result || v_pet_id;

    INSERT INTO owned_pets (student_id, pet_id, count)
    VALUES (v_student_id, v_pet_id, 1)
    ON CONFLICT (student_id, pet_id) DO UPDATE SET
      count = owned_pets.count + 1,
      updated_at = NOW();
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION gacha_multi_pull() TO authenticated;

-- 2d: Create exchange_coins_for_food function
CREATE OR REPLACE FUNCTION exchange_coins_for_food(p_food_amount integer)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_coin_cost INTEGER;
  v_current_coins INTEGER;
  v_food_price CONSTANT INTEGER := 50; -- coins per food
BEGIN
  v_student_id := (SELECT auth.uid());
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_food_amount <= 0 THEN
    RAISE EXCEPTION 'Food amount must be positive';
  END IF;

  v_coin_cost := p_food_amount * v_food_price;

  SELECT coins INTO v_current_coins FROM student_profiles WHERE id = v_student_id;
  IF v_current_coins IS NULL THEN
    RAISE EXCEPTION 'Student profile not found';
  END IF;
  IF v_current_coins < v_coin_cost THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  -- Atomically deduct coins and add food
  UPDATE student_profiles
  SET
    coins = coins - v_coin_cost,
    food = food + p_food_amount
  WHERE id = v_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION exchange_coins_for_food(integer) TO authenticated;
