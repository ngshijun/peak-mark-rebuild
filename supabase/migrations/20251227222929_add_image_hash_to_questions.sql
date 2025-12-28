-- Add image_hash column to questions table for duplicate detection
-- This stores a hash of all images (question image + option images) to detect duplicates
ALTER TABLE questions ADD COLUMN image_hash TEXT;

-- Add index for faster duplicate lookups
CREATE INDEX idx_questions_image_hash ON questions(image_hash) WHERE image_hash IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN questions.image_hash IS 'SHA-256 hash of combined question and option images for duplicate detection';
