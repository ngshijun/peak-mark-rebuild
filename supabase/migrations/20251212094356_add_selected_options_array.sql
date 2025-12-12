-- Migration: Convert selected_option (integer) to selected_options (integer[])
-- This supports both MCQ (single answer) and MRQ (multiple answers)

-- Step 1: Add new array column
ALTER TABLE practice_answers
ADD COLUMN selected_options integer[];

-- Step 2: Migrate existing data from selected_option to selected_options array
UPDATE practice_answers
SET selected_options = ARRAY[selected_option]
WHERE selected_option IS NOT NULL;

-- Step 3: Drop the old column
ALTER TABLE practice_answers
DROP COLUMN selected_option;

-- Step 4: Add comment for documentation
COMMENT ON COLUMN practice_answers.selected_options IS 'Array of selected option numbers (1-4). MCQ has single element, MRQ can have multiple.';
