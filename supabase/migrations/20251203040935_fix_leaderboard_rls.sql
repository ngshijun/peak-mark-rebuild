-- Fix RLS policy on student_profiles to allow leaderboard access
-- Previously, students could only view their own profile, which broke the leaderboard.
-- Now all authenticated users can view basic leaderboard data (xp, current_streak) for all students.

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view relevant student profiles" ON student_profiles;

-- Create new policy: Allow all authenticated users to SELECT (for leaderboard)
CREATE POLICY "All authenticated users can view student profiles"
ON student_profiles
FOR SELECT
TO authenticated
USING (true);
