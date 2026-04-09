-- Add grade_level_id and grade_rank columns to the leaderboard view.
--
-- Previously the view only exposed a global rank. The client was attempting
-- to derive a per-grade-level rank for the logged-in student from the already
-- truncated top-20 dataset, which caused every student outside the top 20 to
-- appear as rank 21. Expose an authoritative per-grade rank from the database
-- so the client never has to recompute it.
--
-- CREATE OR REPLACE VIEW requires existing columns to stay in the same
-- order — new columns are appended at the end.

CREATE OR REPLACE VIEW "public"."leaderboard" WITH ("security_invoker"='true') AS
  SELECT
    p.id,
    p.name,
    p.avatar_path,
    sp.xp,
    public.calculate_display_streak(p.id) AS current_streak,
    gl.name AS grade_level_name,
    rank() OVER (ORDER BY sp.xp DESC) AS rank,
    gl.id AS grade_level_id,
    rank() OVER (PARTITION BY gl.id ORDER BY sp.xp DESC) AS grade_rank
  FROM profiles p
    JOIN student_profiles sp ON p.id = sp.id
    LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
  WHERE p.user_type = 'student'::public.user_type
  ORDER BY sp.xp DESC;
