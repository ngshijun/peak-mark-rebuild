-- Fix weekly leaderboard visibility for students
-- The view joins practice_sessions which has RLS restricting students to their own sessions.
-- With security_invoker=true, students can only see their own weekly XP.
-- Setting security_invoker=false lets the view run as the owner, bypassing practice_sessions RLS.
-- This is safe because the view only exposes aggregated public data (name, XP, rank).

ALTER VIEW public.weekly_leaderboard SET (security_invoker = false);
