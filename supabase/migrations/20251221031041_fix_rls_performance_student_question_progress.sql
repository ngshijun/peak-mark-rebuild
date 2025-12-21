-- Fix RLS performance issue: wrap auth.uid() in (select ...) to prevent re-evaluation per row
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Drop the existing policy
DROP POLICY IF EXISTS "Students can update own question progress" ON student_question_progress;

-- Recreate with optimized pattern
CREATE POLICY "Students can update own question progress"
ON student_question_progress
FOR UPDATE
TO authenticated
USING (student_id = (SELECT auth.uid()))
WITH CHECK (student_id = (SELECT auth.uid()));

-- Also fix the existing INSERT and SELECT policies if they have the same issue
DROP POLICY IF EXISTS "Students can insert own question progress" ON student_question_progress;
DROP POLICY IF EXISTS "Students can read own question progress" ON student_question_progress;

CREATE POLICY "Students can insert own question progress"
ON student_question_progress
FOR INSERT
TO authenticated
WITH CHECK (student_id = (SELECT auth.uid()));

CREATE POLICY "Students can read own question progress"
ON student_question_progress
FOR SELECT
TO authenticated
USING (student_id = (SELECT auth.uid()));
