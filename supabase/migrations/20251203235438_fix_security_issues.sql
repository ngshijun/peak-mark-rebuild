-- ============================================================================
-- Security Fixes Migration
-- Addresses Supabase security advisor warnings
-- ============================================================================

-- ============================================================================
-- 1. Fix SECURITY DEFINER view issue on leaderboard
-- Change to SECURITY INVOKER so RLS policies of the querying user are respected
-- ============================================================================
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  sp.xp,
  public.calculate_display_streak(p.id) AS current_streak,
  gl.name AS grade_level_name,
  rank() OVER (ORDER BY sp.xp DESC) AS rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
WHERE p.user_type = 'student'
ORDER BY sp.xp DESC;

-- Grant access only to authenticated users (not anon)
REVOKE ALL ON public.leaderboard FROM anon;
GRANT SELECT ON public.leaderboard TO authenticated;

-- ============================================================================
-- 2. Fix function search_path issues
-- Set search_path to empty string to prevent search_path injection attacks
-- ============================================================================

-- Fix update_student_streak function
CREATE OR REPLACE FUNCTION public.update_student_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_streak INTEGER := 0;
  v_check_date DATE := CURRENT_DATE;
  v_practiced BOOLEAN;
BEGIN
  -- First check today
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

-- Fix calculate_display_streak function
CREATE OR REPLACE FUNCTION public.calculate_display_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
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

  -- If last practice was before yesterday, streak is broken
  IF v_last_practiced_date < CURRENT_DATE - 1 THEN
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

-- Fix feed_pet_for_evolution function
CREATE OR REPLACE FUNCTION public.feed_pet_for_evolution(
  p_owned_pet_id UUID,
  p_student_id UUID,
  p_food_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  FROM public.owned_pets
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
  FROM public.student_profiles
  WHERE id = p_student_id;

  IF v_student_food IS NULL OR v_student_food < p_food_amount THEN
    RETURN json_build_object('success', false, 'error', 'Not enough food');
  END IF;

  -- Deduct food from student
  UPDATE public.student_profiles
  SET food = food - p_food_amount
  WHERE id = p_student_id;

  -- Add food to pet
  v_new_food_fed := v_owned_pet.food_fed + p_food_amount;

  UPDATE public.owned_pets
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

-- Fix evolve_pet function
CREATE OR REPLACE FUNCTION public.evolve_pet(
  p_owned_pet_id UUID,
  p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  FROM public.owned_pets
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

  UPDATE public.owned_pets
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

-- ============================================================================
-- 3. Fix materialized view accessible by anon
-- Revoke anon access, only authenticated users (admins) should access it
-- ============================================================================
REVOKE ALL ON public.question_statistics FROM anon;
-- Keep authenticated access (already granted in previous migration)
