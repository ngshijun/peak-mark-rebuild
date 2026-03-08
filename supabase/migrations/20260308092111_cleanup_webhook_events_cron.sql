-- Clean up processed webhook events older than 30 days (runs daily at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-processed-webhook-events',
  '0 3 * * *',
  $$DELETE FROM processed_webhook_events WHERE processed_at < NOW() - INTERVAL '30 days'$$
);
