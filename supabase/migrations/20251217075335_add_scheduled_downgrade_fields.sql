-- Add fields to track scheduled subscription changes (downgrades)
ALTER TABLE child_subscriptions
ADD COLUMN IF NOT EXISTS scheduled_tier subscription_tier DEFAULT NULL,
ADD COLUMN IF NOT EXISTS scheduled_change_date timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_schedule_id text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN child_subscriptions.scheduled_tier IS 'The tier the subscription will change to at the scheduled date';
COMMENT ON COLUMN child_subscriptions.scheduled_change_date IS 'When the scheduled tier change will take effect';
COMMENT ON COLUMN child_subscriptions.stripe_schedule_id IS 'Stripe subscription schedule ID for tracking';
