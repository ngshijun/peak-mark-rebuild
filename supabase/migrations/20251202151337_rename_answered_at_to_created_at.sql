-- Rename answered_at to created_at since we now track when questions are added to a session, not when answered
ALTER TABLE student_question_progress
  RENAME COLUMN answered_at TO created_at;
