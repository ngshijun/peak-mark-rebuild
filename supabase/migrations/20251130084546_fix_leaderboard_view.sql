-- Add current_streak column to student_profiles
ALTER TABLE student_profiles
ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;

-- Create a function to calculate and update streak for a student
CREATE OR REPLACE FUNCTION update_student_streak(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak INTEGER := 0;
  v_current_date DATE := CURRENT_DATE;
  v_practiced BOOLEAN;
BEGIN
  LOOP
    SELECT has_practiced INTO v_practiced
    FROM daily_statuses
    WHERE student_id = p_student_id AND date = v_current_date;

    IF v_practiced IS TRUE THEN
      v_streak := v_streak + 1;
      v_current_date := v_current_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- Update the student's current_streak
  UPDATE student_profiles
  SET current_streak = v_streak
  WHERE id = p_student_id;

  RETURN v_streak;
END;
$$;

-- Create trigger function to update streak when daily_statuses changes
CREATE OR REPLACE FUNCTION trigger_update_student_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update streak for the affected student
  IF TG_OP = 'DELETE' THEN
    PERFORM update_student_streak(OLD.student_id);
    RETURN OLD;
  ELSE
    PERFORM update_student_streak(NEW.student_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger on daily_statuses
DROP TRIGGER IF EXISTS on_daily_status_change ON daily_statuses;
CREATE TRIGGER on_daily_status_change
  AFTER INSERT OR UPDATE OF has_practiced OR DELETE
  ON daily_statuses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_student_streak();

-- Drop existing materialized view and recreate as regular view for real-time support
DROP MATERIALIZED VIEW IF EXISTS leaderboard;

-- Create the leaderboard as a regular view (not materialized) to support real-time
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  sp.xp,
  sp.current_streak,
  gl.name AS grade_level_name,
  RANK() OVER (ORDER BY sp.xp DESC) AS rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
WHERE p.user_type = 'student'
ORDER BY sp.xp DESC;

-- Initialize current_streak for all existing students
DO $$
DECLARE
  student RECORD;
BEGIN
  FOR student IN SELECT id FROM student_profiles LOOP
    PERFORM update_student_streak(student.id);
  END LOOP;
END;
$$;
