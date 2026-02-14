-- Fix mutable search_path security warning on prevent_unlink_with_active_subscription

ALTER FUNCTION prevent_unlink_with_active_subscription()
SET search_path = public;
