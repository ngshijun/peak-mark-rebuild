-- Add sub_topics layer to curriculum hierarchy
-- New hierarchy: grade_levels -> subjects -> topics -> sub_topics

-- 1. Create sub_topics table
CREATE TABLE IF NOT EXISTS public.sub_topics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
    name text NOT NULL,
    cover_image_path text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on sub_topics
ALTER TABLE public.sub_topics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sub_topics (same as topics - public read, admin write)
CREATE POLICY "Allow public read access to sub_topics"
ON public.sub_topics FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admin full access to sub_topics"
ON public.sub_topics FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
);

-- 2. Add sub_topic_id to questions table
ALTER TABLE public.questions
ADD COLUMN sub_topic_id uuid REFERENCES public.sub_topics(id) ON DELETE SET NULL;

-- 3. Add sub_topic_id to practice_sessions table
ALTER TABLE public.practice_sessions
ADD COLUMN sub_topic_id uuid REFERENCES public.sub_topics(id) ON DELETE SET NULL;

-- 4. Add sub_topic_id to student_question_progress table
ALTER TABLE public.student_question_progress
ADD COLUMN sub_topic_id uuid REFERENCES public.sub_topics(id) ON DELETE SET NULL;

-- 5. Update unique constraint on student_question_progress
-- First drop the old constraint if it exists
ALTER TABLE public.student_question_progress
DROP CONSTRAINT IF EXISTS student_question_progress_student_id_topic_id_question_id_c_key;

-- Create new constraint including sub_topic_id
ALTER TABLE public.student_question_progress
ADD CONSTRAINT student_question_progress_unique_key
UNIQUE (student_id, sub_topic_id, question_id, cycle_number);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sub_topics_topic_id ON public.sub_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_sub_topics_display_order ON public.sub_topics(display_order);
CREATE INDEX IF NOT EXISTS idx_questions_sub_topic_id ON public.questions(sub_topic_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_sub_topic_id ON public.practice_sessions(sub_topic_id);
CREATE INDEX IF NOT EXISTS idx_student_question_progress_sub_topic_id ON public.student_question_progress(sub_topic_id);

-- Add comment to explain the migration
COMMENT ON TABLE public.sub_topics IS 'Sub-topics within a topic. Part of curriculum hierarchy: grade_levels -> subjects -> topics -> sub_topics';
COMMENT ON COLUMN public.questions.sub_topic_id IS 'Reference to sub_topic. Questions are now organized by sub-topic instead of topic.';
COMMENT ON COLUMN public.practice_sessions.sub_topic_id IS 'Reference to sub_topic. Practice sessions are now for specific sub-topics.';
COMMENT ON COLUMN public.student_question_progress.sub_topic_id IS 'Reference to sub_topic for tracking question cycling progress.';
