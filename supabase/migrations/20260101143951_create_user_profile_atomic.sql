-- Migration: Create atomic function for user profile creation
-- This ensures both main profile and type-specific profile are created together

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_user_type TEXT,
  p_date_of_birth DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate user type
  IF p_user_type NOT IN ('student', 'parent') THEN
    RAISE EXCEPTION 'Invalid user type: %. Must be student or parent', p_user_type;
  END IF;

  -- Step 1: Create main profile
  INSERT INTO profiles (id, email, name, user_type, date_of_birth)
  VALUES (p_user_id, p_email, p_name, p_user_type::user_type, p_date_of_birth);

  -- Step 2: Create type-specific profile
  IF p_user_type = 'student' THEN
    INSERT INTO student_profiles (id)
    VALUES (p_user_id);
  ELSE
    INSERT INTO parent_profiles (id)
    VALUES (p_user_id);
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, DATE) TO authenticated;

-- Also allow service_role for server-side operations
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT, DATE) TO service_role;
