-- Add trigger to update student streak when daily_statuses is modified
-- The trigger function already exists, just need to create the trigger

CREATE TRIGGER update_streak_trigger
  AFTER INSERT OR UPDATE OR DELETE ON daily_statuses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_student_streak();
