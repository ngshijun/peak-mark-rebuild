-- Migration: Add trigger to automatically update session correct_count when answer is inserted
-- This eliminates the need for a separate DB call per correct answer (Issue #21)

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_session_correct_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if the answer is correct
  IF NEW.is_correct THEN
    UPDATE practice_sessions
    SET correct_count = correct_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on practice_answers table
DROP TRIGGER IF EXISTS after_answer_insert_update_correct_count ON practice_answers;

CREATE TRIGGER after_answer_insert_update_correct_count
AFTER INSERT ON practice_answers
FOR EACH ROW
EXECUTE FUNCTION update_session_correct_count();

-- Add comment for documentation
COMMENT ON FUNCTION update_session_correct_count() IS
  'Automatically increments practice_sessions.correct_count when a correct answer is inserted';
