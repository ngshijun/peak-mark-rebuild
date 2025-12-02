-- Add admin RLS policies for dashboard statistics

-- Admins can view all daily statuses
CREATE POLICY "Admins can view all daily statuses"
  ON daily_statuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admins can view all session questions
CREATE POLICY "Admins can view all session questions"
  ON session_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admins can view all practice answers
CREATE POLICY "Admins can view all practice answers"
  ON practice_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );
