-- Fix search_path for get_tier_from_stripe_price function (security fix)
CREATE OR REPLACE FUNCTION get_tier_from_stripe_price(p_price_id TEXT)
RETURNS subscription_tier AS $$
DECLARE
  v_tier subscription_tier;
BEGIN
  SELECT id INTO v_tier
  FROM subscription_plans
  WHERE stripe_price_id = p_price_id;

  RETURN COALESCE(v_tier, 'basic');
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public;
