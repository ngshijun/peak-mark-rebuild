-- Stripe Production Hardening Migration
-- Addresses: webhook idempotency, duplicate payment prevention, RLS restriction

-- 1. Create processed_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (only service role should access this table)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Index for cleanup queries (events older than 7 days can be purged)
CREATE INDEX idx_processed_webhook_events_processed_at
  ON processed_webhook_events (processed_at);

-- 2. Add unique constraint on payment_history.stripe_invoice_id
-- Prevents duplicate payment records from webhook retries.
-- NULL values are allowed (multiple NULLs don't violate UNIQUE in PostgreSQL).
ALTER TABLE payment_history
  ADD CONSTRAINT uq_payment_history_stripe_invoice_id
  UNIQUE (stripe_invoice_id);

-- 3. Restrict client-side write policies on child_subscriptions
-- All mutations should go through edge functions (service role) to prevent
-- clients from setting their own tier without paying.

-- Drop the overly-permissive policies
DROP POLICY IF EXISTS "Parents can manage child subscriptions" ON child_subscriptions;
DROP POLICY IF EXISTS "Parents can update child subscriptions" ON child_subscriptions;
DROP POLICY IF EXISTS "Parents can delete child subscriptions" ON child_subscriptions;

-- No INSERT/UPDATE/DELETE policies for authenticated users on child_subscriptions.
-- Edge functions use the service_role key which bypasses RLS.
