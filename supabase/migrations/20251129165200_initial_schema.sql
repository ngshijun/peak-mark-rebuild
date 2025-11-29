-- ============================================================================
-- Peak Mark - Supabase Database Migration
-- ============================================================================
-- This migration sets up the complete database schema for the Peak Mark
-- educational gamified learning platform.
--
-- User Types:
--   - Admin: Manages curriculum, questions, and feedback
--   - Student: Practices questions, collects pets, earns XP/coins
--   - Parent: Monitors linked children's progress, manages subscriptions
--
-- Core Features:
--   - Curriculum management (grades, subjects, topics)
--   - Question bank with MCQ and short answer types
--   - Practice sessions with progress tracking
--   - Gamification (pets, XP, coins, streaks, leaderboards)
--   - Parent-student linking system
--   - Subscription management
-- ============================================================================

-- ============================================================================
-- SECTION 1: ENUMS
-- ============================================================================

-- User types for the platform
CREATE TYPE user_type AS ENUM ('admin', 'student', 'parent');

-- Question types supported
CREATE TYPE question_type AS ENUM ('mcq', 'short_answer');

-- Pet rarity levels for gacha system
CREATE TYPE pet_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Daily mood tracking options
CREATE TYPE mood_type AS ENUM ('sad', 'neutral', 'happy');

-- Parent-student invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- Direction of parent-student invitation
CREATE TYPE invitation_direction AS ENUM ('parent_to_student', 'student_to_parent');

-- Subscription tier levels
CREATE TYPE subscription_tier AS ENUM ('basic', 'plus', 'pro', 'max');

-- Feedback categories for question issues
CREATE TYPE feedback_category AS ENUM (
  'question_error',
  'image_error',
  'option_error',
  'answer_error',
  'explanation_error',
  'other'
);

-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 User Profiles
-- ----------------------------------------------------------------------------

-- Main profiles table extending auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  user_type user_type NOT NULL,
  date_of_birth DATE,
  avatar_path TEXT, -- Storage path in 'avatars' bucket
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grade Levels (defined early due to FK dependency)
-- e.g., Grade 1, Grade 2, etc.
CREATE TABLE grade_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pet definitions (defined early due to FK dependency)
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  rarity pet_rarity NOT NULL,
  image_path TEXT NOT NULL, -- Storage path in 'pet-images' bucket
  gacha_weight INTEGER DEFAULT 100, -- Higher = more likely to pull
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student-specific profile data
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  grade_level_id UUID REFERENCES grade_levels(id) ON DELETE SET NULL,
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  food INTEGER DEFAULT 0,
  selected_pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parent-specific profile data (for future extensions)
CREATE TABLE parent_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2.2 Curriculum Structure
-- ----------------------------------------------------------------------------

-- Subjects (e.g., Mathematics, English, Science)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_image_path TEXT, -- Storage path in 'curriculum-images' bucket
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(grade_level_id, name)
);

-- Topics (e.g., Addition, Subtraction, Phonics)
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_image_path TEXT, -- Storage path in 'curriculum-images' bucket
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, name)
);

-- ----------------------------------------------------------------------------
-- 2.3 Questions
-- ----------------------------------------------------------------------------

-- Questions table with embedded MCQ options (max 4 options)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type question_type NOT NULL,
  question TEXT NOT NULL,
  image_path TEXT, -- Storage path in 'question-images' bucket
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  explanation TEXT,

  -- For short_answer type only
  answer TEXT,

  -- For MCQ type: Option 1 (required for MCQ)
  option_1_text TEXT,
  option_1_image_path TEXT, -- Storage path in 'option-images' bucket
  option_1_is_correct BOOLEAN DEFAULT FALSE,

  -- Option 2 (required for MCQ)
  option_2_text TEXT,
  option_2_image_path TEXT,
  option_2_is_correct BOOLEAN DEFAULT FALSE,

  -- Option 3 (optional)
  option_3_text TEXT,
  option_3_image_path TEXT,
  option_3_is_correct BOOLEAN,

  -- Option 4 (optional)
  option_4_text TEXT,
  option_4_image_path TEXT,
  option_4_is_correct BOOLEAN,

  -- Denormalized fields for faster queries (populated via trigger)
  grade_level_id UUID REFERENCES grade_levels(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_short_answer CHECK (
    type != 'short_answer' OR answer IS NOT NULL
  ),
  CONSTRAINT mcq_has_two_options CHECK (
    type != 'mcq' OR (
      (option_1_text IS NOT NULL OR option_1_image_path IS NOT NULL) AND
      (option_2_text IS NOT NULL OR option_2_image_path IS NOT NULL)
    )
  ),
  CONSTRAINT mcq_one_correct CHECK (
    type != 'mcq' OR (
      (COALESCE(option_1_is_correct, FALSE)::int +
       COALESCE(option_2_is_correct, FALSE)::int +
       COALESCE(option_3_is_correct, FALSE)::int +
       COALESCE(option_4_is_correct, FALSE)::int) = 1
    )
  )
);

-- ----------------------------------------------------------------------------
-- 2.4 Practice Sessions & Answers
-- ----------------------------------------------------------------------------

-- Practice Sessions
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  -- Denormalized for faster queries
  grade_level_id UUID REFERENCES grade_levels(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL,
  current_question_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- Calculated on completion
  correct_count INTEGER,
  xp_earned INTEGER,
  coins_earned INTEGER
);

-- Session Questions (tracks which questions are in each session)
CREATE TABLE session_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  UNIQUE(session_id, question_id),
  UNIQUE(session_id, question_order)
);

-- Practice Answers
CREATE TABLE practice_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL, -- SET NULL preserves answer history
  -- For MCQ: which option was selected (1-4)
  selected_option SMALLINT CHECK (selected_option BETWEEN 1 AND 4),
  -- For short_answer
  text_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

-- ----------------------------------------------------------------------------
-- 2.5 Pet System (Gamification)
-- ----------------------------------------------------------------------------

-- Student's owned pets
CREATE TABLE owned_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1, -- Duplicate pets count
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, pet_id)
);

-- ----------------------------------------------------------------------------
-- 2.6 Daily Status & Streaks
-- ----------------------------------------------------------------------------

-- Daily student status tracking
CREATE TABLE daily_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood mood_type,
  has_spun BOOLEAN DEFAULT FALSE,
  spin_reward INTEGER, -- Coins earned from spin (1-5)
  has_practiced BOOLEAN DEFAULT FALSE, -- Set when completing a session
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- ----------------------------------------------------------------------------
-- 2.7 Parent-Student Linking
-- ----------------------------------------------------------------------------

-- Parent-Student Invitations
CREATE TABLE parent_student_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  parent_email TEXT NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  direction invitation_direction NOT NULL,
  status invitation_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  -- Ensure at least one user exists
  CONSTRAINT valid_invitation CHECK (parent_id IS NOT NULL OR student_id IS NOT NULL)
);

-- Parent-Student Links (established relationships)
CREATE TABLE parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 2.8 Subscriptions
-- ----------------------------------------------------------------------------

-- Subscription Plans (reference table)
CREATE TABLE subscription_plans (
  id subscription_tier PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly DECIMAL(10,2) NOT NULL,
  sessions_per_day INTEGER NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  is_highlighted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Child Subscriptions (parent manages for linked children)
CREATE TABLE child_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'basic',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id) -- One subscription per student
);

-- ----------------------------------------------------------------------------
-- 2.9 Question Feedback
-- ----------------------------------------------------------------------------

-- Question Feedback from users
CREATE TABLE question_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category feedback_category NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: MATERIALIZED VIEWS
-- ============================================================================

-- Question Statistics (refresh periodically for performance)
CREATE MATERIALIZED VIEW question_statistics AS
SELECT
  q.id AS question_id,
  COUNT(pa.id) AS attempts,
  COUNT(pa.id) FILTER (WHERE pa.is_correct) AS correct_count,
  ROUND(
    100.0 * COUNT(pa.id) FILTER (WHERE pa.is_correct) / NULLIF(COUNT(pa.id), 0),
    1
  ) AS correctness_rate,
  COALESCE(AVG(pa.time_spent_seconds), 0)::INT AS avg_time_seconds
FROM questions q
LEFT JOIN practice_answers pa ON pa.question_id = q.id
GROUP BY q.id;

-- Leaderboard (refreshed periodically)
-- Note: level is calculated as FLOOR(xp / 500) + 1 on frontend
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  p.id,
  p.name,
  p.avatar_path,
  sp.xp,
  gl.name as grade_level_name,
  RANK() OVER (ORDER BY sp.xp DESC) as rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
WHERE p.user_type = 'student'
ORDER BY sp.xp DESC;

-- ============================================================================
-- SECTION 4: INDEXES
-- ============================================================================

-- Required unique index for CONCURRENTLY refresh on materialized views
CREATE UNIQUE INDEX idx_question_statistics_id ON question_statistics(question_id);
CREATE UNIQUE INDEX idx_leaderboard_id ON leaderboard(id);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank);

-- Profiles
CREATE INDEX idx_profiles_user_type ON profiles(user_type);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Student Profiles
CREATE INDEX idx_student_profiles_grade_level ON student_profiles(grade_level_id);
CREATE INDEX idx_student_profiles_xp ON student_profiles(xp DESC);

-- Curriculum
CREATE INDEX idx_subjects_grade_level ON subjects(grade_level_id);
CREATE INDEX idx_topics_subject ON topics(subject_id);

-- Questions
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_grade_level ON questions(grade_level_id);
CREATE INDEX idx_questions_subject ON questions(subject_id);

-- Practice Sessions
CREATE INDEX idx_practice_sessions_student ON practice_sessions(student_id);
CREATE INDEX idx_practice_sessions_topic ON practice_sessions(topic_id);
CREATE INDEX idx_practice_sessions_completed ON practice_sessions(completed_at);

-- Session Questions
CREATE INDEX idx_session_questions_session ON session_questions(session_id);
CREATE INDEX idx_session_questions_question ON session_questions(question_id);

-- Practice Answers
CREATE INDEX idx_practice_answers_session ON practice_answers(session_id);
CREATE INDEX idx_practice_answers_question ON practice_answers(question_id);

-- Owned Pets
CREATE INDEX idx_owned_pets_student ON owned_pets(student_id);

-- Daily Status
CREATE INDEX idx_daily_statuses_student_date ON daily_statuses(student_id, date);

-- Parent-Student Links
CREATE INDEX idx_parent_student_links_parent ON parent_student_links(parent_id);
CREATE INDEX idx_parent_student_links_student ON parent_student_links(student_id);

-- Invitations
CREATE INDEX idx_invitations_parent ON parent_student_invitations(parent_id);
CREATE INDEX idx_invitations_student ON parent_student_invitations(student_id);
CREATE INDEX idx_invitations_status ON parent_student_invitations(status);

-- Feedback
CREATE INDEX idx_feedback_question ON question_feedback(question_id);

-- Child Subscriptions
CREATE INDEX idx_child_subscriptions_parent ON child_subscriptions(parent_id);
CREATE INDEX idx_child_subscriptions_student ON child_subscriptions(student_id);

-- ============================================================================
-- SECTION 5: FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Utility Functions
-- ----------------------------------------------------------------------------

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5.2 Question Hierarchy Functions
-- ----------------------------------------------------------------------------

-- Trigger function to populate denormalized grade_level_id and subject_id
CREATE OR REPLACE FUNCTION populate_question_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM topics t
  JOIN subjects s ON t.subject_id = s.id
  WHERE t.id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to populate denormalized fields in practice_sessions
CREATE OR REPLACE FUNCTION populate_session_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM topics t
  JOIN subjects s ON t.subject_id = s.id
  WHERE t.id = NEW.topic_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5.3 Practice Session Functions
-- ----------------------------------------------------------------------------

-- Function to complete a practice session and award XP/coins
CREATE OR REPLACE FUNCTION complete_practice_session(
  p_session_id UUID,
  p_correct_count INTEGER,
  p_total_questions INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_student_id UUID;
  v_base_xp INTEGER := 50;
  v_bonus_xp_per_correct INTEGER := 10;
  v_base_coins INTEGER := 20;
  v_bonus_coins_per_correct INTEGER := 5;
  v_total_xp INTEGER;
  v_total_coins INTEGER;
BEGIN
  -- Get student ID
  SELECT student_id INTO v_student_id FROM practice_sessions WHERE id = p_session_id;

  -- Calculate rewards
  v_total_xp := v_base_xp + (p_correct_count * v_bonus_xp_per_correct);
  v_total_coins := v_base_coins + (p_correct_count * v_bonus_coins_per_correct);

  -- Update session
  UPDATE practice_sessions SET
    completed_at = NOW(),
    correct_count = p_correct_count,
    xp_earned = v_total_xp,
    coins_earned = v_total_coins
  WHERE id = p_session_id;

  -- Update student profile (level calculated on frontend)
  UPDATE student_profiles SET
    xp = xp + v_total_xp,
    coins = coins + v_total_coins
  WHERE id = v_student_id;

  -- Mark today as practiced
  INSERT INTO daily_statuses (student_id, date, has_practiced)
  VALUES (v_student_id, CURRENT_DATE, TRUE)
  ON CONFLICT (student_id, date) DO UPDATE SET
    has_practiced = TRUE,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5.4 Gacha System Functions
-- ----------------------------------------------------------------------------

-- Function to perform a gacha pull
CREATE OR REPLACE FUNCTION gacha_pull(p_student_id UUID, p_cost INTEGER DEFAULT 100)
RETURNS UUID AS $$
DECLARE
  v_current_coins INTEGER;
  v_random_value FLOAT;
  v_selected_pet_id UUID;
  v_rarity pet_rarity;
BEGIN
  -- Check coins
  SELECT coins INTO v_current_coins FROM student_profiles WHERE id = p_student_id;
  IF v_current_coins < p_cost THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  -- Deduct coins
  UPDATE student_profiles SET coins = coins - p_cost WHERE id = p_student_id;

  -- Determine rarity based on probabilities
  -- 60% common, 30% rare, 9% epic, 1% legendary
  v_random_value := random();
  IF v_random_value < 0.01 THEN
    v_rarity := 'legendary';
  ELSIF v_random_value < 0.10 THEN
    v_rarity := 'epic';
  ELSIF v_random_value < 0.40 THEN
    v_rarity := 'rare';
  ELSE
    v_rarity := 'common';
  END IF;

  -- Select random pet of that rarity
  SELECT id INTO v_selected_pet_id FROM pets WHERE rarity = v_rarity ORDER BY random() LIMIT 1;

  -- Add to owned pets (or increment count if already owned)
  INSERT INTO owned_pets (student_id, pet_id, count)
  VALUES (p_student_id, v_selected_pet_id, 1)
  ON CONFLICT (student_id, pet_id) DO UPDATE SET
    count = owned_pets.count + 1,
    updated_at = NOW();

  RETURN v_selected_pet_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5.5 Streak Calculation Function
-- ----------------------------------------------------------------------------

-- Function to calculate student's current practice streak
CREATE OR REPLACE FUNCTION get_student_streak(p_student_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_current_date DATE := CURRENT_DATE;
  v_practiced BOOLEAN;
BEGIN
  LOOP
    SELECT has_practiced INTO v_practiced
    FROM daily_statuses
    WHERE student_id = p_student_id AND date = v_current_date;

    IF v_practiced IS TRUE THEN
      v_streak := v_streak + 1;
      v_current_date := v_current_date - INTERVAL '1 day';
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5.6 Materialized View Refresh Functions
-- ----------------------------------------------------------------------------

-- Function to refresh question statistics
CREATE OR REPLACE FUNCTION refresh_question_statistics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5.7 User Signup Handler
-- ----------------------------------------------------------------------------

-- Trigger function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_type user_type;
  v_name TEXT;
BEGIN
  -- Extract user_type from metadata (set during signup)
  v_user_type := COALESCE(
    (NEW.raw_user_meta_data->>'user_type')::user_type,
    'student'::user_type
  );
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');

  -- Create main profile
  INSERT INTO profiles (id, name, email, user_type)
  VALUES (NEW.id, v_name, NEW.email, v_user_type);

  -- Create type-specific profile
  IF v_user_type = 'student' THEN
    INSERT INTO student_profiles (id) VALUES (NEW.id);
  ELSIF v_user_type = 'parent' THEN
    INSERT INTO parent_profiles (id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 6: TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 Updated_at Triggers
-- ----------------------------------------------------------------------------

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parent_profiles_updated_at
  BEFORE UPDATE ON parent_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grade_levels_updated_at
  BEFORE UPDATE ON grade_levels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_topics_updated_at
  BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pets_updated_at
  BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_owned_pets_updated_at
  BEFORE UPDATE ON owned_pets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_statuses_updated_at
  BEFORE UPDATE ON daily_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_child_subscriptions_updated_at
  BEFORE UPDATE ON child_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6.2 Hierarchy Population Triggers
-- ----------------------------------------------------------------------------

CREATE TRIGGER populate_question_hierarchy_trigger
  BEFORE INSERT OR UPDATE OF topic_id ON questions
  FOR EACH ROW EXECUTE FUNCTION populate_question_hierarchy();

CREATE TRIGGER populate_session_hierarchy_trigger
  BEFORE INSERT OR UPDATE OF topic_id ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION populate_session_hierarchy();

-- ----------------------------------------------------------------------------
-- 6.3 Auth Triggers
-- ----------------------------------------------------------------------------

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 Profiles
-- ----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can view profiles (needed for leaderboard, linking, etc.)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 7.2 Student Profiles
-- ----------------------------------------------------------------------------

ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

-- Students can view their own profile
CREATE POLICY "Students can view own profile"
  ON student_profiles FOR SELECT
  USING (auth.uid() = id);

-- Students can update their own profile
CREATE POLICY "Students can update own profile"
  ON student_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Parents can view linked children's profiles
CREATE POLICY "Parents can view linked children profiles"
  ON student_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = student_profiles.id
    )
  );

-- Admins can view all student profiles
CREATE POLICY "Admins can view all student profiles"
  ON student_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.3 Parent Profiles
-- ----------------------------------------------------------------------------

ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;

-- Parents can view their own profile
CREATE POLICY "Parents can view own profile"
  ON parent_profiles FOR SELECT
  USING (auth.uid() = id);

-- Parents can update their own profile
CREATE POLICY "Parents can update own profile"
  ON parent_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all parent profiles
CREATE POLICY "Admins can view all parent profiles"
  ON parent_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.4 Curriculum Tables
-- ----------------------------------------------------------------------------

ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Everyone can read curriculum
CREATE POLICY "Curriculum is viewable by everyone"
  ON grade_levels FOR SELECT USING (true);

CREATE POLICY "Subjects are viewable by everyone"
  ON subjects FOR SELECT USING (true);

CREATE POLICY "Topics are viewable by everyone"
  ON topics FOR SELECT USING (true);

-- Only admins can manage curriculum
CREATE POLICY "Admins can manage grade levels"
  ON grade_levels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can manage subjects"
  ON subjects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can manage topics"
  ON topics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.5 Questions
-- ----------------------------------------------------------------------------

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read questions
CREATE POLICY "Questions are viewable by everyone"
  ON questions FOR SELECT USING (true);

-- Only admins can insert questions
CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Only admins can update questions
CREATE POLICY "Admins can update questions"
  ON questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Only admins can delete questions
CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.6 Practice Sessions
-- ----------------------------------------------------------------------------

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

-- Students can view their own sessions
CREATE POLICY "Students can view own sessions"
  ON practice_sessions FOR SELECT
  USING (auth.uid() = student_id);

-- Students can create their own sessions
CREATE POLICY "Students can create own sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can update their own sessions
CREATE POLICY "Students can update own sessions"
  ON practice_sessions FOR UPDATE
  USING (auth.uid() = student_id);

-- Parents can view linked children's sessions
CREATE POLICY "Parents can view linked children sessions"
  ON practice_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = practice_sessions.student_id
    )
  );

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
  ON practice_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.7 Session Questions
-- ----------------------------------------------------------------------------

ALTER TABLE session_questions ENABLE ROW LEVEL SECURITY;

-- Students can view session questions for their own sessions
CREATE POLICY "Students can view own session questions"
  ON session_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = session_questions.session_id AND student_id = auth.uid()
    )
  );

-- Students can create session questions for their own sessions
CREATE POLICY "Students can create own session questions"
  ON session_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = session_questions.session_id AND student_id = auth.uid()
    )
  );

-- Parents can view linked children's session questions
CREATE POLICY "Parents can view linked children session questions"
  ON session_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions ps
      JOIN parent_student_links psl ON ps.student_id = psl.student_id
      WHERE ps.id = session_questions.session_id AND psl.parent_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7.8 Practice Answers
-- ----------------------------------------------------------------------------

ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;

-- Students can view their own answers
CREATE POLICY "Students can view own answers"
  ON practice_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = practice_answers.session_id AND student_id = auth.uid()
    )
  );

-- Students can create their own answers
CREATE POLICY "Students can create own answers"
  ON practice_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = practice_answers.session_id AND student_id = auth.uid()
    )
  );

-- Students can update their own answers
CREATE POLICY "Students can update own answers"
  ON practice_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = practice_answers.session_id AND student_id = auth.uid()
    )
  );

-- Parents can view linked children's answers
CREATE POLICY "Parents can view linked children answers"
  ON practice_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions ps
      JOIN parent_student_links psl ON ps.student_id = psl.student_id
      WHERE ps.id = practice_answers.session_id AND psl.parent_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7.9 Pets
-- ----------------------------------------------------------------------------

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Everyone can view pets
CREATE POLICY "Pets are viewable by everyone"
  ON pets FOR SELECT USING (true);

-- Only admins can manage pets
CREATE POLICY "Admins can manage pets"
  ON pets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.10 Owned Pets
-- ----------------------------------------------------------------------------

ALTER TABLE owned_pets ENABLE ROW LEVEL SECURITY;

-- Students can view their own pets
CREATE POLICY "Students can view own pets"
  ON owned_pets FOR SELECT
  USING (auth.uid() = student_id);

-- Students can add their own pets (through gacha function)
CREATE POLICY "Students can add own pets"
  ON owned_pets FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can update their own pets
CREATE POLICY "Students can update own pets"
  ON owned_pets FOR UPDATE
  USING (auth.uid() = student_id);

-- Parents can view linked children's pets
CREATE POLICY "Parents can view linked children pets"
  ON owned_pets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = owned_pets.student_id
    )
  );

-- ----------------------------------------------------------------------------
-- 7.11 Daily Statuses
-- ----------------------------------------------------------------------------

ALTER TABLE daily_statuses ENABLE ROW LEVEL SECURITY;

-- Students can view their own daily statuses
CREATE POLICY "Students can view own daily statuses"
  ON daily_statuses FOR SELECT
  USING (auth.uid() = student_id);

-- Students can create their own daily statuses
CREATE POLICY "Students can create own daily statuses"
  ON daily_statuses FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can update their own daily statuses
CREATE POLICY "Students can update own daily statuses"
  ON daily_statuses FOR UPDATE
  USING (auth.uid() = student_id);

-- Parents can view linked children's daily statuses
CREATE POLICY "Parents can view linked children daily statuses"
  ON daily_statuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = daily_statuses.student_id
    )
  );

-- ----------------------------------------------------------------------------
-- 7.12 Parent-Student Invitations
-- ----------------------------------------------------------------------------

ALTER TABLE parent_student_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view invitations they're part of
CREATE POLICY "Users can view own invitations"
  ON parent_student_invitations FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = student_id);

-- Users can create invitations
CREATE POLICY "Users can create invitations"
  ON parent_student_invitations FOR INSERT
  WITH CHECK (auth.uid() = parent_id OR auth.uid() = student_id);

-- Users can update invitations they're part of
CREATE POLICY "Users can update own invitations"
  ON parent_student_invitations FOR UPDATE
  USING (auth.uid() = parent_id OR auth.uid() = student_id);

-- ----------------------------------------------------------------------------
-- 7.13 Parent-Student Links
-- ----------------------------------------------------------------------------

ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- Users can view links they're part of
CREATE POLICY "Users can view own links"
  ON parent_student_links FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = student_id);

-- Links are created via function/trigger, not directly
-- But allow insert for the linking process
CREATE POLICY "Users can create links when accepting invitation"
  ON parent_student_links FOR INSERT
  WITH CHECK (auth.uid() = parent_id OR auth.uid() = student_id);

-- Users can delete links they're part of (unlinking)
CREATE POLICY "Users can delete own links"
  ON parent_student_links FOR DELETE
  USING (auth.uid() = parent_id OR auth.uid() = student_id);

-- ----------------------------------------------------------------------------
-- 7.14 Subscription Plans
-- ----------------------------------------------------------------------------

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view subscription plans
CREATE POLICY "Subscription plans are viewable by everyone"
  ON subscription_plans FOR SELECT USING (true);

-- Only admins can manage subscription plans
CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 7.15 Child Subscriptions
-- ----------------------------------------------------------------------------

ALTER TABLE child_subscriptions ENABLE ROW LEVEL SECURITY;

-- Parents can view their child subscriptions
CREATE POLICY "Parents can view child subscriptions"
  ON child_subscriptions FOR SELECT
  USING (auth.uid() = parent_id);

-- Students can view their own subscription
CREATE POLICY "Students can view own subscription"
  ON child_subscriptions FOR SELECT
  USING (auth.uid() = student_id);

-- Parents can manage subscriptions for linked children
CREATE POLICY "Parents can manage child subscriptions"
  ON child_subscriptions FOR INSERT
  WITH CHECK (
    auth.uid() = parent_id AND
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = child_subscriptions.student_id
    )
  );

CREATE POLICY "Parents can update child subscriptions"
  ON child_subscriptions FOR UPDATE
  USING (
    auth.uid() = parent_id AND
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = child_subscriptions.student_id
    )
  );

CREATE POLICY "Parents can delete child subscriptions"
  ON child_subscriptions FOR DELETE
  USING (
    auth.uid() = parent_id AND
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = child_subscriptions.student_id
    )
  );

-- ----------------------------------------------------------------------------
-- 7.16 Question Feedback
-- ----------------------------------------------------------------------------

ALTER TABLE question_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON question_feedback FOR SELECT
  USING (auth.uid() = reported_by);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON question_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Authenticated users can create feedback
CREATE POLICY "Authenticated users can create feedback"
  ON question_feedback FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- Admins can update feedback (to resolve it)
CREATE POLICY "Admins can update feedback"
  ON question_feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON question_feedback FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ============================================================================
-- SECTION 8: STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('question-images', 'question-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']),
  ('option-images', 'option-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']),
  ('curriculum-images', 'curriculum-images', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('avatars', 'avatars', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('pet-images', 'pet-images', true, 524288, ARRAY['image/png', 'image/webp']);

-- ----------------------------------------------------------------------------
-- 8.1 Question Images Storage Policies
-- ----------------------------------------------------------------------------

-- Public read access
CREATE POLICY "Question images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

-- Admin upload/update/delete
CREATE POLICY "Admins can upload question images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'question-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update question images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'question-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete question images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'question-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 8.2 Option Images Storage Policies
-- ----------------------------------------------------------------------------

-- Public read access
CREATE POLICY "Option images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'option-images');

-- Admin upload/update/delete
CREATE POLICY "Admins can upload option images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'option-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update option images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'option-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete option images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'option-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 8.3 Curriculum Images Storage Policies
-- ----------------------------------------------------------------------------

-- Public read access
CREATE POLICY "Curriculum images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'curriculum-images');

-- Admin upload/update/delete
CREATE POLICY "Admins can upload curriculum images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'curriculum-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update curriculum images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'curriculum-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete curriculum images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'curriculum-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ----------------------------------------------------------------------------
-- 8.4 Avatar Storage Policies
-- ----------------------------------------------------------------------------

-- Public read access
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 8.5 Pet Images Storage Policies
-- ----------------------------------------------------------------------------

-- Public read access
CREATE POLICY "Pet images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-images');

-- Admin upload/update/delete
CREATE POLICY "Admins can upload pet images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pet-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update pet images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pet-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete pet images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pet-images' AND
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ============================================================================
-- SECTION 9: SEED DATA
-- ============================================================================

-- Default Subscription Plans
INSERT INTO subscription_plans (id, name, price_monthly, sessions_per_day, features, is_highlighted) VALUES
  ('basic', 'Basic', 0.00, 3, '["3 practice sessions per day", "Basic progress tracking", "Access to all subjects"]', FALSE),
  ('plus', 'Plus', 9.99, 10, '["10 practice sessions per day", "Detailed progress reports", "Priority support"]', FALSE),
  ('pro', 'Pro', 19.99, 25, '["25 practice sessions per day", "Advanced analytics", "Downloadable reports", "Priority support"]', TRUE),
  ('max', 'Max', 29.99, 50, '["50 practice sessions per day", "All Pro features", "1-on-1 tutoring sessions", "Custom curriculum"]', FALSE);

-- Default Pets (using image_path - actual images need to be uploaded to pet-images bucket)
INSERT INTO pets (name, rarity, image_path, gacha_weight) VALUES
  -- Common (60% total)
  ('Hamster', 'common', 'hamster.png', 100),
  ('Chick', 'common', 'chick.png', 100),
  ('Bunny', 'common', 'bunny.png', 100),
  ('Puppy', 'common', 'puppy.png', 100),
  ('Kitten', 'common', 'kitten.png', 100),
  ('Piglet', 'common', 'piglet.png', 100),
  -- Rare (30% total)
  ('Fox', 'rare', 'fox.png', 60),
  ('Panda', 'rare', 'panda.png', 60),
  ('Koala', 'rare', 'koala.png', 60),
  ('Penguin', 'rare', 'penguin.png', 60),
  ('Owl', 'rare', 'owl.png', 60),
  -- Epic (9% total)
  ('Unicorn', 'epic', 'unicorn.png', 30),
  ('Dragon', 'epic', 'dragon.png', 30),
  ('Phoenix', 'epic', 'phoenix.png', 30),
  -- Legendary (1% total)
  ('Golden Dragon', 'legendary', 'golden-dragon.png', 5),
  ('Celestial Fox', 'legendary', 'celestial-fox.png', 5);

-- ============================================================================
-- SECTION 10: SCHEDULED JOBS (pg_cron)
-- ============================================================================
-- Uncomment these if pg_cron extension is enabled in your Supabase project

-- Refresh materialized views every 5 minutes
-- SELECT cron.schedule('refresh-materialized-views', '*/5 * * * *', 'SELECT refresh_all_materialized_views()');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
