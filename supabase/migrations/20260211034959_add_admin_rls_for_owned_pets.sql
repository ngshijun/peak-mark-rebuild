-- Add admin SELECT access to owned_pets table
DROP POLICY IF EXISTS "Users can view relevant pets" ON public.owned_pets;

CREATE POLICY "Users can view relevant pets" ON public.owned_pets
FOR SELECT TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_id = (SELECT auth.uid())
    AND student_id = owned_pets.student_id
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
    AND user_type = 'admin'
  )
);
