-- Rename 'basic' tier to 'core' in the subscription_tier enum

-- Step 1: Rename the enum value
ALTER TYPE subscription_tier RENAME VALUE 'basic' TO 'core';

-- Step 2: Update the subscription_plans table row name to reflect the new tier
UPDATE subscription_plans
SET name = 'Core'
WHERE id = 'core';

-- Step 3: Update default value for child_subscriptions.tier column
-- The default was 'basic', now should be 'core'
ALTER TABLE child_subscriptions
ALTER COLUMN tier SET DEFAULT 'core'::subscription_tier;
