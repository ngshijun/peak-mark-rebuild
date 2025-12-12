-- Add 'mrq' (Multiple Response Question) to the question_type enum
ALTER TYPE question_type ADD VALUE 'mrq';

-- Add comment to explain the types
COMMENT ON TYPE question_type IS 'Question types: mcq (single correct answer), mrq (multiple correct answers), short_answer (text response)';
