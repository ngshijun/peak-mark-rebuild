-- Add UPDATE policy for students so upsert can work properly
-- Without this, upsert fails silently when there's a conflict
CREATE POLICY "Students can update own question progress"
ON student_question_progress
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());
