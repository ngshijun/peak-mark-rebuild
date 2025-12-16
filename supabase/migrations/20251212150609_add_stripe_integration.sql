-- ============================================================================
-- Stripe Integration Migration
-- Adds Stripe customer/subscription tracking and payment history
-- ============================================================================

-- 1. Add stripe_customer_id to parent_profiles
ALTER TABLE parent_profiles
ADD COLUMN stripe_customer_id TEXT UNIQUE;

-- Index for fast lookup by Stripe customer ID
CREATE INDEX idx_parent_profiles_stripe_customer_id
ON parent_profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- 2. Add Stripe fields to child_subscriptions
ALTER TABLE child_subscriptions
ADD COLUMN stripe_subscription_id TEXT UNIQUE,
ADD COLUMN stripe_price_id TEXT,
ADD COLUMN stripe_status TEXT,
ADD COLUMN current_period_start TIMESTAMPTZ,
ADD COLUMN current_period_end TIMESTAMPTZ,
ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Index for fast lookup by Stripe subscription ID
CREATE INDEX idx_child_subscriptions_stripe_subscription_id
ON child_subscriptions(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

-- 3. Add stripe_price_id to subscription_plans for mapping
ALTER TABLE subscription_plans
ADD COLUMN stripe_price_id TEXT;

-- 4. Create payment_history table for audit trail
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL, -- 'succeeded', 'failed', 'pending', 'refunded'
  tier subscription_tier,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for payment_history
CREATE INDEX idx_payment_history_parent ON payment_history(parent_id);
CREATE INDEX idx_payment_history_student ON payment_history(student_id);
CREATE INDEX idx_payment_history_stripe_invoice ON payment_history(stripe_invoice_id);
CREATE INDEX idx_payment_history_created ON payment_history(created_at DESC);

-- 5. RLS Policies for payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Parents can view their own payment history
CREATE POLICY "Parents can view own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid() = parent_id);

-- Admins can view all payment history
CREATE POLICY "Admins can view all payment history"
  ON payment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'::user_type
    )
  );

-- Service role (webhooks) can insert payment records
-- Note: Supabase Edge Functions with service role key bypass RLS

-- 6. Helper function to get tier from Stripe price ID
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
$$ LANGUAGE plpgsql STABLE;
