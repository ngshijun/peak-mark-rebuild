-- Migrate all Max tier subscribers to Pro tier
-- Max tier is being deprecated; Pro now includes AI summaries
--
-- NOTE: Existing Max Stripe subscriptions must be manually migrated
-- in the Stripe dashboard to the Pro price ID.

-- Update student_profiles
UPDATE student_profiles
SET subscription_tier = 'pro'
WHERE subscription_tier = 'max';

-- Update child_subscriptions (DB records)
UPDATE child_subscriptions
SET tier = 'pro'
WHERE tier = 'max';

-- Update any scheduled changes targeting max
UPDATE child_subscriptions
SET scheduled_tier = 'pro'
WHERE scheduled_tier = 'max';

-- Clear the Max plan's Stripe price ID to prevent new signups
UPDATE subscription_plans
SET stripe_price_id = NULL
WHERE id = 'max';
