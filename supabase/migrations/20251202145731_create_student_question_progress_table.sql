-- Table to track which questions a student has answered per topic per cycle
-- Used for question cycling: students won't see repeated questions until they complete all questions in a topic
CREATE TABLE student_question_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  cycle_number INT NOT NULL DEFAULT 1,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure a question can only be marked once per cycle per student per topic
  UNIQUE(student_id, topic_id, question_id, cycle_number)
);

-- Index for efficient lookups when starting a session
CREATE INDEX idx_student_question_progress_lookup
  ON student_question_progress(student_id, topic_id, cycle_number);

-- RLS policies
ALTER TABLE student_question_progress ENABLE ROW LEVEL SECURITY;

-- Students can read their own progress
CREATE POLICY "Students can read own question progress"
  ON student_question_progress
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Students can insert their own progress
CREATE POLICY "Students can insert own question progress"
  ON student_question_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Service role has full access (for admin operations if needed)
CREATE POLICY "Service role has full access to question progress"
  ON student_question_progress
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
