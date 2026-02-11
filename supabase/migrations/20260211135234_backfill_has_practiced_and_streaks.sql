-- Backfill: fix has_practiced values and recalculate streaks.
-- Previously has_practiced was set on session start; it should only be TRUE
-- when at least one session was actually completed that day.

-- Step 1: Reset has_practiced to FALSE where no completed session exists
UPDATE daily_statuses ds
SET has_practiced = FALSE
WHERE ds.has_practiced = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM practice_sessions ps
    WHERE ps.student_id = ds.student_id
      AND ps.completed_at IS NOT NULL
      AND (ps.completed_at AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE = ds.date
  );

-- Step 2: Ensure has_practiced = TRUE where completed sessions exist
-- (should already be correct, but ensures consistency)
UPDATE daily_statuses ds
SET has_practiced = TRUE
WHERE ds.has_practiced = FALSE
  AND EXISTS (
    SELECT 1 FROM practice_sessions ps
    WHERE ps.student_id = ds.student_id
      AND ps.completed_at IS NOT NULL
      AND (ps.completed_at AT TIME ZONE 'Asia/Kuala_Lumpur')::DATE = ds.date
  );

-- Step 3: Recalculate current_streak for all students
-- The update_student_streak function counts consecutive days backwards from today
DO $$
DECLARE
  v_student RECORD;
BEGIN
  FOR v_student IN SELECT DISTINCT id FROM student_profiles LOOP
    PERFORM update_student_streak(v_student.id);
  END LOOP;
END;
$$;
