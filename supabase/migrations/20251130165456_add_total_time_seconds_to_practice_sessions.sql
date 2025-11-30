-- Add total_time_seconds column to practice_sessions
-- This stores the sum of time_spent_seconds from all answers
-- which accurately tracks actual time spent even if student left and came back
ALTER TABLE practice_sessions
ADD COLUMN total_time_seconds INTEGER DEFAULT 0;
