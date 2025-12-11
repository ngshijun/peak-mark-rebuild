-- SIMPLER APPROACH: Rename existing topics to sub_topics, add new topics layer above
-- This preserves all existing FKs - they now point to sub_topics (renamed from topics)
--
-- New hierarchy: grade_levels -> subjects -> topics (NEW) -> sub_topics (renamed from topics)

-- 1. First, drop the sub_topics table created by previous migration (if exists)
DROP TABLE IF EXISTS public.sub_topics CASCADE;

-- 2. Drop the sub_topic_id columns added by previous migration
ALTER TABLE public.questions DROP COLUMN IF EXISTS sub_topic_id;
ALTER TABLE public.practice_sessions DROP COLUMN IF EXISTS sub_topic_id;
ALTER TABLE public.student_question_progress DROP COLUMN IF EXISTS sub_topic_id;

-- 3. Rename the existing topics table to sub_topics
ALTER TABLE public.topics RENAME TO sub_topics;

-- 4. Drop the old FK constraint before renaming column
ALTER TABLE public.sub_topics DROP CONSTRAINT IF EXISTS topics_subject_id_fkey;

-- 5. Create the new topics table FIRST (sits between subjects and sub_topics)
CREATE TABLE public.topics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    name text NOT NULL,
    cover_image_path text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. Migrate data: Create a "General" topic for each subject that has existing sub_topics
-- We use the subject_id from sub_topics (still named subject_id at this point)
INSERT INTO public.topics (id, subject_id, name, display_order)
SELECT DISTINCT
    gen_random_uuid(),
    subject_id,
    'General',
    0
FROM public.sub_topics
WHERE subject_id IS NOT NULL;

-- 7. Add a temporary column to store the new topic_id
ALTER TABLE public.sub_topics ADD COLUMN new_topic_id uuid;

-- 8. Update the temporary column with the matching topic id
UPDATE public.sub_topics st
SET new_topic_id = t.id
FROM public.topics t
WHERE st.subject_id = t.subject_id;

-- 9. Drop the old subject_id column and rename new_topic_id to topic_id
ALTER TABLE public.sub_topics DROP COLUMN subject_id;
ALTER TABLE public.sub_topics RENAME COLUMN new_topic_id TO topic_id;

-- 10. Make topic_id NOT NULL
ALTER TABLE public.sub_topics ALTER COLUMN topic_id SET NOT NULL;

-- 11. Add foreign key from sub_topics.topic_id to topics.id
ALTER TABLE public.sub_topics
ADD CONSTRAINT sub_topics_topic_id_fkey
FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;

-- 12. Enable RLS on new topics table
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies for topics (same as subjects - public read, admin write)
CREATE POLICY "Allow public read access to topics"
ON public.topics FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow admin full access to topics"
ON public.topics FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.user_type = 'admin'
    )
);

-- 14. Update the populate_question_hierarchy trigger to use new hierarchy
DROP TRIGGER IF EXISTS populate_question_hierarchy_trigger ON public.questions;
DROP FUNCTION IF EXISTS populate_question_hierarchy();

CREATE OR REPLACE FUNCTION populate_question_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM sub_topics st
  JOIN topics t ON st.topic_id = t.id
  JOIN subjects s ON t.subject_id = s.id
  WHERE st.id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER populate_question_hierarchy_trigger
BEFORE INSERT OR UPDATE ON public.questions
FOR EACH ROW
EXECUTE FUNCTION populate_question_hierarchy();

-- 15. Update the populate_session_hierarchy trigger to use new hierarchy
DROP TRIGGER IF EXISTS populate_session_hierarchy_trigger ON public.practice_sessions;
DROP FUNCTION IF EXISTS populate_session_hierarchy();

CREATE OR REPLACE FUNCTION populate_session_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM sub_topics st
  JOIN topics t ON st.topic_id = t.id
  JOIN subjects s ON t.subject_id = s.id
  WHERE st.id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER populate_session_hierarchy_trigger
BEFORE INSERT OR UPDATE ON public.practice_sessions
FOR EACH ROW
EXECUTE FUNCTION populate_session_hierarchy();

-- 16. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_display_order ON public.topics(display_order);
CREATE INDEX IF NOT EXISTS idx_sub_topics_topic_id ON public.sub_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_sub_topics_display_order ON public.sub_topics(display_order);

-- 17. Add comments
COMMENT ON TABLE public.topics IS 'Topics within a subject. Part of curriculum hierarchy: grade_levels -> subjects -> topics -> sub_topics';
COMMENT ON TABLE public.sub_topics IS 'Sub-topics within a topic (renamed from original topics table). Questions and practice sessions reference sub_topics via topic_id column.';
