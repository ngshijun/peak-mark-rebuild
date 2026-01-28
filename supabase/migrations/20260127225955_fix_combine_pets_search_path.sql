-- Fix search_path security issue for combine_pets function
-- Setting search_path to empty prevents search_path injection attacks

CREATE OR REPLACE FUNCTION combine_pets(
  p_student_id uuid,
  p_owned_pet_ids uuid[]
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
  v_owned_pet record;
  v_pet_count integer;
BEGIN
  -- Validate exactly 4 pets
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

  -- Verify all 4 pets are same rarity and owned with sufficient count
  SELECT COUNT(DISTINCT op.id) INTO v_pet_count
  FROM public.owned_pets op
  JOIN public.pets p ON p.id = op.pet_id
  WHERE op.id = ANY(p_owned_pet_ids)
    AND op.student_id = p_student_id
    AND p.rarity = v_rarity
    AND op.count >= 1;

  IF v_pet_count != 4 THEN
    RETURN json_build_object('success', false, 'error', 'All pets must be same rarity and owned');
  END IF;

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

  -- Consume the 4 input pets (decrement count or delete)
  FOR v_owned_pet IN
    SELECT * FROM public.owned_pets WHERE id = ANY(p_owned_pet_ids)
  LOOP
    IF v_owned_pet.count > 1 THEN
      UPDATE public.owned_pets SET count = count - 1 WHERE id = v_owned_pet.id;
    ELSE
      DELETE FROM public.owned_pets WHERE id = v_owned_pet.id;
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
