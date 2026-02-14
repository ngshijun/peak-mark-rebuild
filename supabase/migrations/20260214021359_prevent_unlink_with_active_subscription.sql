-- Prevent unlinking a parent-student relationship when an active paid subscription exists.
-- This trigger acts as a hard guard at the database level.

CREATE OR REPLACE FUNCTION prevent_unlink_with_active_subscription()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM child_subscriptions cs
    WHERE cs.parent_id = OLD.parent_id
      AND cs.student_id = OLD.student_id
      AND cs.is_active = true
      AND cs.tier != 'core'
  ) THEN
    RAISE EXCEPTION 'Cannot unlink while an active paid subscription exists. Please cancel the subscription first.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_unlink_with_active_subscription
  BEFORE DELETE ON parent_student_links
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unlink_with_active_subscription();
