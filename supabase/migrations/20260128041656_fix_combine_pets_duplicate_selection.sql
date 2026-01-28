-- Fix combine_pets to handle selecting the same pet multiple times
-- When a user has 4+ of a pet, they should be able to combine using that same pet 4 times

CREATE OR REPLACE FUNCTION combine_pets(
  p_student_id uuid,
  p_owned_pet_ids uuid[]  -- Array of 4 owned_pet IDs (may contain duplicates)
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rarity public.pet_rarity;
  v_next_rarity public.pet_rarity;
  v_success boolean;
  v_success_rate numeric;
  v_result_rarity public.pet_rarity;
  v_result_pet_id uuid;
  v_unique_id uuid;
  v_required_count integer;
  v_actual_count integer;
  v_actual_rarity public.pet_rarity;
BEGIN
  -- Validate exactly 4 pets in array
  IF array_length(p_owned_pet_ids, 1) IS NULL OR array_length(p_owned_pet_ids, 1) != 4 THEN
    RETURN json_build_object('success', false, 'error', 'Must select exactly 4 pets');
  END IF;

  -- Get rarity of first pet
  SELECT p.rarity INTO v_rarity
  FROM public.owned_pets op
  JOIN public.pets p ON p.id = op.pet_id
  WHERE op.id = p_owned_pet_ids[1] AND op.student_id = p_student_id;

  IF v_rarity IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pet not found or not owned');
  END IF;

  IF v_rarity = 'legendary' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot combine legendary pets');
  END IF;

  -- Validate each unique owned_pet_id:
  -- 1. Must be owned by the student
  -- 2. Must be same rarity
  -- 3. Must have enough count to cover how many times it appears in the array
  FOR v_unique_id IN SELECT DISTINCT unnest(p_owned_pet_ids)
  LOOP
    -- Count how many times this ID appears in the input array
    SELECT COUNT(*) INTO v_required_count
    FROM unnest(p_owned_pet_ids) AS id
    WHERE id = v_unique_id;

    -- Get actual count and rarity from database
    SELECT op.count, p.rarity INTO v_actual_count, v_actual_rarity
    FROM public.owned_pets op
    JOIN public.pets p ON p.id = op.pet_id
    WHERE op.id = v_unique_id AND op.student_id = p_student_id;

    -- Check if pet exists and is owned
    IF v_actual_count IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Pet not found or not owned');
    END IF;

    -- Check if same rarity
    IF v_actual_rarity != v_rarity THEN
      RETURN json_build_object('success', false, 'error', 'All pets must be same rarity');
    END IF;

    -- Check if user has enough of this pet
    IF v_actual_count < v_required_count THEN
      RETURN json_build_object('success', false, 'error', 'Not enough of this pet to combine');
    END IF;
  END LOOP;

  -- Determine next rarity and success rate
  v_next_rarity := CASE v_rarity
    WHEN 'common' THEN 'rare'::public.pet_rarity
    WHEN 'rare' THEN 'epic'::public.pet_rarity
    WHEN 'epic' THEN 'legendary'::public.pet_rarity
  END;

  -- Success rates: Common->Rare 50%, Rare->Epic 35%, Epic->Legendary 25%
  v_success_rate := CASE v_rarity
    WHEN 'common' THEN 0.50
    WHEN 'rare' THEN 0.35
    WHEN 'epic' THEN 0.25
    ELSE 0
  END;

  -- Roll for success
  v_success := random() < v_success_rate;
  v_result_rarity := CASE WHEN v_success THEN v_next_rarity ELSE v_rarity END;

  -- Select random result pet of the result rarity
  SELECT id INTO v_result_pet_id
  FROM public.pets
  WHERE rarity = v_result_rarity
  ORDER BY random()
  LIMIT 1;

  IF v_result_pet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No pets available for result rarity');
  END IF;

  -- Consume the 4 input pets (decrement count based on how many times each ID appears)
  FOR v_unique_id IN SELECT DISTINCT unnest(p_owned_pet_ids)
  LOOP
    -- Count how many times this ID appears
    SELECT COUNT(*) INTO v_required_count
    FROM unnest(p_owned_pet_ids) AS id
    WHERE id = v_unique_id;

    -- Get current count
    SELECT count INTO v_actual_count
    FROM public.owned_pets
    WHERE id = v_unique_id;

    -- Decrement or delete
    IF v_actual_count > v_required_count THEN
      UPDATE public.owned_pets SET count = count - v_required_count WHERE id = v_unique_id;
    ELSE
      DELETE FROM public.owned_pets WHERE id = v_unique_id;
    END IF;
  END LOOP;

  -- Add result pet at tier 1
  INSERT INTO public.owned_pets (student_id, pet_id, tier, count)
  VALUES (p_student_id, v_result_pet_id, 1, 1)
  ON CONFLICT (student_id, pet_id)
  DO UPDATE SET count = public.owned_pets.count + 1;

  RETURN json_build_object(
    'success', true,
    'upgraded', v_success,
    'result_pet_id', v_result_pet_id,
    'result_rarity', v_result_rarity
  );
END;
$$;
