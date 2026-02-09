-- Weekly Leaderboard Feature
-- Adds: rewards table, weekly XP view, distribution function, pg_cron schedule, performance index

-- ============================================================================
-- 1. Performance Index
-- ============================================================================
-- Composite index for efficient weekly XP aggregation from practice_sessions
CREATE INDEX IF NOT EXISTS idx_practice_sessions_completed_student
  ON practice_sessions(completed_at, student_id);

-- ============================================================================
-- 2. Weekly Leaderboard Rewards Table
-- ============================================================================
CREATE TABLE weekly_leaderboard_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  weekly_xp INTEGER NOT NULL,
  coins_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start, student_id)
);

ALTER TABLE weekly_leaderboard_rewards ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users
CREATE POLICY "Authenticated users can read weekly rewards"
  ON weekly_leaderboard_rewards FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. Weekly Leaderboard View
-- ============================================================================
-- Computes XP earned in the current week (Monday 00:00 MYT to now)
-- date_trunc('week', ...) truncates to ISO Monday
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  COALESCE(SUM(ps.xp_earned), 0)::INTEGER AS weekly_xp,
  sp.xp AS total_xp,
  gl.name AS grade_level_name,
  RANK() OVER (ORDER BY COALESCE(SUM(ps.xp_earned), 0) DESC) AS rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
LEFT JOIN practice_sessions ps
  ON ps.student_id = p.id
  AND ps.completed_at IS NOT NULL
  AND ps.completed_at >= date_trunc('week', NOW() AT TIME ZONE 'Asia/Kuala_Lumpur') AT TIME ZONE 'Asia/Kuala_Lumpur'
WHERE p.user_type = 'student'
GROUP BY p.id, p.name, p.avatar_path, sp.xp, gl.name
HAVING COALESCE(SUM(ps.xp_earned), 0) > 0
ORDER BY weekly_xp DESC;

-- ============================================================================
-- 4. Distribute Weekly Leaderboard Rewards Function
-- ============================================================================
CREATE OR REPLACE FUNCTION distribute_weekly_leaderboard_rewards()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start DATE;
  v_week_end TIMESTAMPTZ;
  v_week_start_ts TIMESTAMPTZ;
  v_already_distributed BOOLEAN;
  v_coin_rewards INTEGER[] := ARRAY[500, 400, 300, 250, 200, 150, 125, 100, 75, 50];
  v_record RECORD;
BEGIN
  -- Calculate previous week boundaries in MYT (Asia/Kuala_Lumpur = UTC+8)
  -- "Previous week" = the Monday-to-Sunday that just ended
  v_week_start := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Kuala_Lumpur') - INTERVAL '1 day')::DATE;
  v_week_start_ts := v_week_start::TIMESTAMPTZ AT TIME ZONE 'Asia/Kuala_Lumpur';
  v_week_end := v_week_start_ts + INTERVAL '7 days';

  -- Idempotency check: skip if rewards already exist for this week
  SELECT EXISTS(
    SELECT 1 FROM weekly_leaderboard_rewards WHERE week_start = v_week_start
  ) INTO v_already_distributed;

  IF v_already_distributed THEN
    RETURN;
  END IF;

  -- Get top 10 students by weekly XP for the previous week
  FOR v_record IN
    SELECT
      ps.student_id,
      COALESCE(SUM(ps.xp_earned), 0)::INTEGER AS weekly_xp,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ps.xp_earned), 0) DESC) AS rank
    FROM practice_sessions ps
    WHERE ps.completed_at IS NOT NULL
      AND ps.completed_at >= v_week_start_ts
      AND ps.completed_at < v_week_end
    GROUP BY ps.student_id
    HAVING COALESCE(SUM(ps.xp_earned), 0) > 0
    ORDER BY weekly_xp DESC
    LIMIT 10
  LOOP
    -- Insert reward record
    INSERT INTO weekly_leaderboard_rewards (week_start, student_id, rank, weekly_xp, coins_awarded)
    VALUES (v_week_start, v_record.student_id, v_record.rank, v_record.weekly_xp, v_coin_rewards[v_record.rank]);

    -- Add coins to student profile
    UPDATE student_profiles
    SET coins = coins + v_coin_rewards[v_record.rank]
    WHERE id = v_record.student_id;
  END LOOP;
END;
$$;

-- ============================================================================
-- 5. pg_cron Schedule
-- ============================================================================
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule: Sunday 16:00 UTC = Monday 00:00 MYT (UTC+8)
SELECT cron.schedule(
  'distribute-weekly-leaderboard-rewards',
  '0 16 * * 0',
  $$SELECT distribute_weekly_leaderboard_rewards()$$
);
