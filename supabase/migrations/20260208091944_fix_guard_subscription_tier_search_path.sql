-- Fix: set immutable search_path on guard_subscription_tier function

CREATE OR REPLACE FUNCTION guard_subscription_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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
