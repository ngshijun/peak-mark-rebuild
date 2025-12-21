-- Add unique constraint for upsert to work properly
-- This ensures a student can only have one progress record per question per cycle per topic
ALTER TABLE student_question_progress
ADD CONSTRAINT student_question_progress_unique
UNIQUE (student_id, topic_id, question_id, cycle_number);
