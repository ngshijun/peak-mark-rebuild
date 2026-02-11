-- Drop the mark_daily_practiced RPC function.
-- It is no longer needed because the auto_mark_practiced_on_complete trigger
-- on practice_sessions now handles setting has_practiced automatically when
-- a session is completed, and the existing update_streak_trigger on
-- daily_statuses handles streak updates.

REVOKE EXECUTE ON FUNCTION mark_daily_practiced(UUID, UUID) FROM authenticated;
DROP FUNCTION IF EXISTS mark_daily_practiced(UUID, UUID);
