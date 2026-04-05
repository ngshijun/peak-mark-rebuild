-- Lock down column-level UPDATE grants across all user-updatable tables.
-- Revoke broad table-level UPDATE from authenticated, then grant UPDATE
-- only on columns that are legitimately client-settable.
-- SECURITY DEFINER RPCs are unaffected — they run as the function owner.

-- ============================================================
-- 1. profiles (CRITICAL — prevents role escalation via user_type)
-- ============================================================
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (name, date_of_birth, avatar_path, has_completed_tour)
  ON TABLE public.profiles TO authenticated;

-- ============================================================
-- 2. practice_sessions (HIGH — prevents XP/coin inflation)
-- ============================================================
REVOKE UPDATE ON TABLE public.practice_sessions FROM authenticated;

GRANT UPDATE (current_question_index, completed_at, total_time_seconds, correct_count)
  ON TABLE public.practice_sessions TO authenticated;

-- ============================================================
-- 3. owned_pets (HIGH — all mutations via RPCs only)
-- ============================================================
REVOKE UPDATE ON TABLE public.owned_pets FROM authenticated;

-- ============================================================
-- 4. weekly_leaderboard_rewards (HIGH — prevents rank/coin tampering)
-- ============================================================
REVOKE UPDATE ON TABLE public.weekly_leaderboard_rewards FROM authenticated;

GRANT UPDATE (seen_at)
  ON TABLE public.weekly_leaderboard_rewards TO authenticated;

-- ============================================================
-- 5. parent_profiles (HIGH — stripe_customer_id set by webhook only)
-- ============================================================
REVOKE UPDATE ON TABLE public.parent_profiles FROM authenticated;

-- ============================================================
-- 6. daily_statuses (MEDIUM — prevents spin/practice flag tampering)
-- ============================================================
REVOKE UPDATE ON TABLE public.daily_statuses FROM authenticated;

GRANT UPDATE (mood)
  ON TABLE public.daily_statuses TO authenticated;

-- ============================================================
-- 7. practice_answers (MEDIUM — prevents marking own answers correct)
-- ============================================================
REVOKE UPDATE ON TABLE public.practice_answers FROM authenticated;

GRANT UPDATE (selected_options, text_answer, time_spent_seconds, answered_at)
  ON TABLE public.practice_answers TO authenticated;

-- ============================================================
-- 8. parent_student_invitations (LOW — prevents forging invitation details)
-- ============================================================
REVOKE UPDATE ON TABLE public.parent_student_invitations FROM authenticated;

GRANT UPDATE (status, responded_at)
  ON TABLE public.parent_student_invitations TO authenticated;
