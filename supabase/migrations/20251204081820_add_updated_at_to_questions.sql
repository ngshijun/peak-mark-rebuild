-- Add updated_at column to questions table for tracking edits
ALTER TABLE public.questions
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Set initial updated_at to created_at for existing records
UPDATE public.questions
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Make updated_at non-nullable after setting initial values
ALTER TABLE public.questions
ALTER COLUMN updated_at SET NOT NULL;

-- Create trigger to automatically update updated_at on row update
CREATE OR REPLACE FUNCTION public.update_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_updated_at_trigger
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_questions_updated_at();
