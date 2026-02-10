-- Fix weekly reward distribution to handle tied XP correctly
-- Changes ROW_NUMBER() (arbitrary tie-breaking) to DENSE_RANK() (fair tie handling)
-- Students with the same weekly XP get the same rank and the same reward

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

  -- Get top 10 ranked students by weekly XP for the previous week
  -- DENSE_RANK ensures tied students get the same rank and no reward tiers are skipped
  FOR v_record IN
    WITH ranked AS (
      SELECT
        ps.student_id,
        COALESCE(SUM(ps.xp_earned), 0)::INTEGER AS weekly_xp,
        DENSE_RANK() OVER (ORDER BY COALESCE(SUM(ps.xp_earned), 0) DESC) AS rank
      FROM practice_sessions ps
      WHERE ps.completed_at IS NOT NULL
        AND ps.completed_at >= v_week_start_ts
        AND ps.completed_at < v_week_end
      GROUP BY ps.student_id
      HAVING COALESCE(SUM(ps.xp_earned), 0) > 0
    )
    SELECT * FROM ranked WHERE rank <= 10
    ORDER BY rank
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
