-- Enforce: each student can only have one linked parent

-- Add unique constraint on student_id (one parent per student)
ALTER TABLE parent_student_links
ADD CONSTRAINT parent_student_links_student_id_unique UNIQUE (student_id);

-- Update accept_parent_student_invitation to check for existing parent link
CREATE OR REPLACE FUNCTION accept_parent_student_invitation(
  p_invitation_id UUID,
  p_accepting_user_id UUID,
  p_is_parent BOOLEAN
)
RETURNS TABLE (
  link_id UUID,
  parent_id UUID,
  student_id UUID,
  linked_at TIMESTAMPTZ,
  parent_name TEXT,
  parent_email TEXT,
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

  -- Check if student already has a linked parent
  IF EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_student_links.student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'Student already has a linked parent';
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
  RETURNING id, parent_student_links.linked_at INTO v_link_id, v_linked_at;

  -- Step 3: Return the link data with profile information
  RETURN QUERY
  SELECT
    v_link_id,
    v_parent_id,
    v_student_id,
    v_linked_at,
    p.name,
    p.email,
    sp_profile.name,
    sp_profile.email,
    sp_profile.avatar_path,
    gl.name
  FROM profiles p
  CROSS JOIN profiles sp_profile
  LEFT JOIN student_profiles sp ON sp.id = v_student_id
  LEFT JOIN grade_levels gl ON gl.id = sp.grade_level_id
  WHERE p.id = v_parent_id
    AND sp_profile.id = v_student_id;
END;
$$;
