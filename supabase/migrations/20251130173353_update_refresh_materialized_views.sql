-- Update refresh_all_materialized_views to only refresh question_statistics
-- Since leaderboard is now a regular view (not materialized), it doesn't need manual refresh

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
  -- Only refresh question_statistics as it's the only remaining materialized view
  -- leaderboard was converted to a regular view in migration 20251130084546
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
END;
$$ LANGUAGE plpgsql;
