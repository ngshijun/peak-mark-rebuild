-- Add AI summary column to practice_sessions table
ALTER TABLE practice_sessions
ADD COLUMN ai_summary TEXT;

-- Add comment for documentation
COMMENT ON COLUMN practice_sessions.ai_summary IS 'AI-generated summary of the session performance, generated for Max tier subscribers';
