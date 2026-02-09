-- Fix security and performance advisories for weekly leaderboard

-- 1. Fix SECURITY DEFINER view — set to INVOKER (default, safe)
ALTER VIEW weekly_leaderboard SET (security_invoker = on);

-- 2. Add missing index on foreign key for weekly_leaderboard_rewards.student_id
CREATE INDEX idx_weekly_leaderboard_rewards_student_id
  ON weekly_leaderboard_rewards(student_id);
