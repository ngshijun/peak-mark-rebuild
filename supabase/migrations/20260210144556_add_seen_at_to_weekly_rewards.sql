-- Move reward seen state from localStorage to database so it persists across devices.
-- NULL = unseen, timestamp = when the student dismissed the reward dialog.

ALTER TABLE public.weekly_leaderboard_rewards
ADD COLUMN seen_at TIMESTAMPTZ;

-- Allow students to mark their own rewards as seen
CREATE POLICY "Students can update own rewards"
ON public.weekly_leaderboard_rewards
FOR UPDATE TO authenticated
USING (student_id = (SELECT auth.uid()))
WITH CHECK (student_id = (SELECT auth.uid()));
