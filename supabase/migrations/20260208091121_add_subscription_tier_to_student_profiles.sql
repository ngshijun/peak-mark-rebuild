-- Add subscription_tier to student_profiles as single source of truth.
-- Synced automatically from child_subscriptions via trigger.

-- 1. Add column with default 'core'
ALTER TABLE student_profiles
  ADD COLUMN subscription_tier subscription_tier NOT NULL DEFAULT 'core';

-- 2. Backfill from active child_subscriptions
UPDATE student_profiles sp
SET subscription_tier = cs.tier
FROM child_subscriptions cs
WHERE cs.student_id = sp.id
  AND cs.is_active = true;

-- 3. Index for filtering/querying by tier
CREATE INDEX idx_student_profiles_subscription_tier
  ON student_profiles (subscription_tier);

-- 4. Sync trigger: propagate child_subscriptions changes → student_profiles
CREATE OR REPLACE FUNCTION sync_subscription_tier_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_new_tier subscription_tier;
BEGIN
  -- Determine which student is affected
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
  ELSE
    v_student_id := NEW.student_id;
  END IF;

  -- Resolve the current active tier for this student
  SELECT cs.tier INTO v_new_tier
  FROM child_subscriptions cs
  WHERE cs.student_id = v_student_id
    AND cs.is_active = true
  ORDER BY cs.updated_at DESC
  LIMIT 1;

  -- If no active subscription, revert to 'core'
  IF v_new_tier IS NULL THEN
    v_new_tier := 'core';
  END IF;

  -- Update student_profiles
  UPDATE student_profiles
  SET subscription_tier = v_new_tier
  WHERE id = v_student_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_sync_subscription_tier
  AFTER INSERT OR UPDATE OR DELETE ON child_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_tier_to_profile();

-- 5. Guard trigger: prevent authenticated users from directly changing subscription_tier.
--    Only SECURITY DEFINER functions (triggers, service role) can change it.
CREATE OR REPLACE FUNCTION guard_subscription_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow if not in a user session (service role / SECURITY DEFINER context)
  IF current_setting('request.jwt.claim.role', true) IS NULL
     OR current_setting('request.jwt.claim.role', true) = '' THEN
    RETURN NEW;
  END IF;

  -- In an authenticated session, silently revert the tier change
  IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
    NEW.subscription_tier := OLD.subscription_tier;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_subscription_tier
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION guard_subscription_tier();
