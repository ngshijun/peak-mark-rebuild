-- Change start_date and next_billing_date from date to timestamptz
-- so they are consistent with all other time columns and display correctly
-- in the user's local timezone (MYT).
-- Existing date values will be cast to midnight UTC timestamps.
ALTER TABLE child_subscriptions
  ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz,
  ALTER COLUMN next_billing_date TYPE timestamptz USING next_billing_date::timestamptz;
