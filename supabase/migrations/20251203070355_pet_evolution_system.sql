-- Pet Evolution System
-- Adds tier support for pets (1, 2, 3) with progressive evolution costs
-- Students feed food to evolve pets to higher tiers

-- Add tier column to owned_pets (default tier 1)
ALTER TABLE owned_pets
ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 3);

-- Add tier-specific image paths to pets table
-- Tier 1 uses the existing image_path column
ALTER TABLE pets
ADD COLUMN IF NOT EXISTS tier2_image_path TEXT,
ADD COLUMN IF NOT EXISTS tier3_image_path TEXT;

-- Add food_fed column to track accumulated food for evolution
ALTER TABLE owned_pets
ADD COLUMN IF NOT EXISTS food_fed INTEGER NOT NULL DEFAULT 0;

-- Evolution costs (progressive)
-- Tier 1 -> 2: 10 food
-- Tier 2 -> 3: 25 food
-- These are constants in the application code, not stored in DB

-- Create function to feed a pet (accumulates food_fed)
CREATE OR REPLACE FUNCTION feed_pet_for_evolution(
  p_owned_pet_id UUID,
  p_student_id UUID,
  p_food_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owned_pet RECORD;
  v_student_food INTEGER;
  v_new_food_fed INTEGER;
  v_required_food INTEGER;
  v_can_evolve BOOLEAN;
BEGIN
  -- Get the owned pet
  SELECT * INTO v_owned_pet
  FROM owned_pets
  WHERE id = p_owned_pet_id AND student_id = p_student_id;

  IF v_owned_pet IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pet not found');
  END IF;

  -- Check if at max tier
  IF v_owned_pet.tier >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Pet is already at max tier');
  END IF;

  -- Get student's food balance
  SELECT food INTO v_student_food
  FROM student_profiles
  WHERE id = p_student_id;

  IF v_student_food IS NULL OR v_student_food < p_food_amount THEN
    RETURN json_build_object('success', false, 'error', 'Not enough food');
  END IF;

  -- Deduct food from student
  UPDATE student_profiles
  SET food = food - p_food_amount
  WHERE id = p_student_id;

  -- Add food to pet
  v_new_food_fed := v_owned_pet.food_fed + p_food_amount;

  UPDATE owned_pets
  SET food_fed = v_new_food_fed
  WHERE id = p_owned_pet_id;

  -- Calculate if can evolve
  IF v_owned_pet.tier = 1 THEN
    v_required_food := 10;
  ELSE
    v_required_food := 25;
  END IF;

  v_can_evolve := v_new_food_fed >= v_required_food;

  RETURN json_build_object(
    'success', true,
    'food_fed', v_new_food_fed,
    'required_food', v_required_food,
    'can_evolve', v_can_evolve
  );
END;
$$;

-- Create function to evolve a pet (called when student clicks "Evolve" button)
CREATE OR REPLACE FUNCTION evolve_pet(
  p_owned_pet_id UUID,
  p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owned_pet RECORD;
  v_current_tier INTEGER;
  v_food_fed INTEGER;
  v_required_food INTEGER;
  v_new_tier INTEGER;
BEGIN
  -- Get the owned pet
  SELECT * INTO v_owned_pet
  FROM owned_pets
  WHERE id = p_owned_pet_id AND student_id = p_student_id;

  IF v_owned_pet IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pet not found');
  END IF;

  v_current_tier := v_owned_pet.tier;
  v_food_fed := v_owned_pet.food_fed;

  -- Check if already max tier
  IF v_current_tier >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'Pet is already at max tier');
  END IF;

  -- Calculate required food for next evolution
  IF v_current_tier = 1 THEN
    v_required_food := 10;
  ELSE
    v_required_food := 25;
  END IF;

  -- Check if enough food has been fed
  IF v_food_fed < v_required_food THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not enough food fed',
      'current', v_food_fed,
      'required', v_required_food
    );
  END IF;

  -- Evolve the pet
  v_new_tier := v_current_tier + 1;

  UPDATE owned_pets
  SET
    tier = v_new_tier,
    food_fed = 0  -- Reset food counter after evolution
  WHERE id = p_owned_pet_id;

  RETURN json_build_object(
    'success', true,
    'new_tier', v_new_tier,
    'pet_id', v_owned_pet.pet_id
  );
END;
$$;
