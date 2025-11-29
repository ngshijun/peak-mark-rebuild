# Peak Mark - Supabase Database Schema

This document outlines the complete database schema for the Peak Mark educational gamified learning platform using Supabase (PostgreSQL), including authentication, database tables, and storage buckets.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Database Tables](#database-tables)
4. [Storage Buckets](#storage-buckets)
5. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
6. [Indexes](#indexes)
7. [Database Functions & Triggers](#database-functions--triggers)

---

## Overview

### User Types
- **Admin**: Manages curriculum, questions, and feedback
- **Student**: Practices questions, collects pets, earns XP/coins
- **Parent**: Monitors linked children's progress, manages subscriptions

### Core Features
- Curriculum management (grades, subjects, topics)
- Question bank with MCQ and short answer types
- Practice sessions with progress tracking
- Gamification (pets, XP, coins, streaks, leaderboards)
- Parent-student linking system
- Subscription management

---

## Authentication

Supabase Auth handles user authentication automatically. The `auth.users` table is managed by Supabase.

### Custom User Profiles

We extend the auth system with a `profiles` table that stores user-specific data.

---

## Database Tables

### 1. Profiles (User Accounts)

```sql
-- Enum for user types
CREATE TYPE user_type AS ENUM ('admin', 'student', 'parent');

-- Main profiles table extending auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  user_type user_type NOT NULL,
  date_of_birth DATE,
  avatar_path TEXT,
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

-- Parent-specific profile data (optional, for future extensions)
CREATE TABLE parent_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Curriculum Structure

```sql
-- Grade Levels (e.g., Grade 1, Grade 2)
CREATE TABLE grade_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects (e.g., Mathematics, English, Science)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level_id UUID NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cover_image_path TEXT, -- Storage path for cover image
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
  cover_image_path TEXT, -- Storage path for cover image
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, name)
);
```

### 3. Questions (with embedded MCQ options)

```sql
-- Enum for question types
CREATE TYPE question_type AS ENUM ('mcq', 'short_answer');

-- Questions table (MCQ options embedded as columns, max 4 options)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type question_type NOT NULL,
  question TEXT NOT NULL,
  image_path TEXT, -- Storage path for question image
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  explanation TEXT,

  -- For short_answer type only
  answer TEXT,

  -- For MCQ type: Option 1 (required for MCQ)
  option_1_text TEXT,
  option_1_image_path TEXT,
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

  -- Denormalized fields for faster queries (updated via triggers)
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

-- Question Statistics (materialized view, refresh periodically)
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

-- Required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_question_statistics_id ON question_statistics(question_id);

-- Refresh command (call via pg_cron or scheduled function)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
```

### 4. Practice Sessions & Answers

```sql
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
  question_id UUID REFERENCES questions(id) ON DELETE SET NULL, -- SET NULL preserves answer history when question deleted
  -- For MCQ: which option was selected (1-4), shuffling handled at display time
  selected_option SMALLINT CHECK (selected_option BETWEEN 1 AND 4),
  -- For short_answer
  text_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);
```

### 5. Pet System (Gamification)

```sql
-- Enum for pet rarity
CREATE TYPE pet_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');

-- Pet definitions (master list)
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  rarity pet_rarity NOT NULL,
  image_path TEXT NOT NULL, -- Storage path for custom pet image
  -- Gacha probabilities (stored for reference)
  gacha_weight INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
```

### 6. Daily Status & Streaks

```sql
-- Enum for mood types
CREATE TYPE mood_type AS ENUM ('sad', 'neutral', 'happy');

-- Daily student status
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
```

### 7. Parent-Student Linking

```sql
-- Enum for invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- Enum for invitation direction
CREATE TYPE invitation_direction AS ENUM ('parent_to_student', 'student_to_parent');

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
```

### 8. Subscriptions

```sql
-- Enum for subscription tiers
CREATE TYPE subscription_tier AS ENUM ('basic', 'plus', 'pro', 'max');

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
```

### 9. Question Feedback

```sql
-- Enum for feedback categories
CREATE TYPE feedback_category AS ENUM (
  'question_error',
  'image_error',
  'option_error',
  'answer_error',
  'explanation_error',
  'other'
);

-- Question Feedback from users
CREATE TABLE question_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category feedback_category NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 10. Leaderboard View

```sql
-- Materialized view for leaderboard (refreshed periodically)
CREATE MATERIALIZED VIEW leaderboard AS
SELECT
  p.id,
  p.name,
  p.avatar_url,
  sp.xp,
  sp.level,
  gl.name as grade_level_name,
  RANK() OVER (ORDER BY sp.xp DESC) as rank
FROM profiles p
JOIN student_profiles sp ON p.id = sp.id
LEFT JOIN grade_levels gl ON sp.grade_level_id = gl.id
WHERE p.user_type = 'student'
ORDER BY sp.xp DESC;

-- Index for fast lookups
CREATE UNIQUE INDEX leaderboard_id_idx ON leaderboard(id);
CREATE INDEX leaderboard_rank_idx ON leaderboard(rank);
```

---

## Storage Buckets

Supabase Storage buckets for image assets:

### 1. `question-images`
- **Purpose**: Store images used in questions
- **Access**: Public read, authenticated upload (admin only)
- **File types**: PNG, JPG, JPEG, WebP, GIF
- **Max size**: 5MB
- **Path structure**: `{grade_level_id}/{subject_id}/{topic_id}/{question_id}.{ext}`

### 2. `curriculum-images`
- **Purpose**: Cover images for subjects and topics
- **Access**: Public read, authenticated upload (admin only)
- **File types**: PNG, JPG, JPEG, WebP
- **Max size**: 2MB
- **Path structure**:
  - Subjects: `subjects/{subject_id}.{ext}`
  - Topics: `topics/{topic_id}.{ext}`

### 3. `avatars`
- **Purpose**: User profile avatars
- **Access**: Public read, authenticated upload (own avatar only)
- **File types**: PNG, JPG, JPEG, WebP
- **Max size**: 1MB
- **Path structure**: `{user_id}.{ext}`

### 4. `pet-images`
- **Purpose**: Custom pet images (if not using emojis)
- **Access**: Public read, admin upload only
- **File types**: PNG, WebP (with transparency)
- **Max size**: 500KB
- **Path structure**: `{pet_id}.{ext}`

---

## Row Level Security (RLS) Policies

### Profiles Table

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles (for leaderboard, linking, etc.)
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### Student Profiles Table

```sql
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
```

### Curriculum Tables (Grade Levels, Subjects, Topics)

```sql
-- Enable RLS on curriculum tables
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

-- Only admins can modify curriculum
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
```

### Questions Table

```sql
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Everyone can read questions
CREATE POLICY "Questions are viewable by everyone"
  ON questions FOR SELECT USING (true);

-- Only admins can insert/delete questions (no updates - questions are immutable)
CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'
    )
  );
```

### Practice Sessions & Answers

```sql
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_questions ENABLE ROW LEVEL SECURITY;

-- Students can view and create their own sessions
CREATE POLICY "Students can view own sessions"
  ON practice_sessions FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create own sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);

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

-- Similar policies for practice_answers and session_questions
CREATE POLICY "Students can view own answers"
  ON practice_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = practice_answers.session_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Students can create own answers"
  ON practice_answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE id = practice_answers.session_id AND student_id = auth.uid()
    )
  );
```

### Owned Pets

```sql
ALTER TABLE owned_pets ENABLE ROW LEVEL SECURITY;

-- Students can view their own pets
CREATE POLICY "Students can view own pets"
  ON owned_pets FOR SELECT
  USING (auth.uid() = student_id);

-- Students can add pets (through gacha function)
CREATE POLICY "Students can add own pets"
  ON owned_pets FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own pets"
  ON owned_pets FOR UPDATE
  USING (auth.uid() = student_id);
```

### Parent-Student Links & Invitations

```sql
ALTER TABLE parent_student_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

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

-- Users can view links they're part of
CREATE POLICY "Users can view own links"
  ON parent_student_links FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = student_id);
```

### Subscriptions

```sql
ALTER TABLE child_subscriptions ENABLE ROW LEVEL SECURITY;

-- Parents can manage subscriptions for their linked children
CREATE POLICY "Parents can view child subscriptions"
  ON child_subscriptions FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can manage child subscriptions"
  ON child_subscriptions FOR ALL
  USING (
    auth.uid() = parent_id AND
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid() AND student_id = child_subscriptions.student_id
    )
  );
```

---

## Indexes

```sql
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

-- Practice Sessions
CREATE INDEX idx_practice_sessions_student ON practice_sessions(student_id);
CREATE INDEX idx_practice_sessions_topic ON practice_sessions(topic_id);
CREATE INDEX idx_practice_sessions_completed ON practice_sessions(completed_at);
CREATE INDEX idx_practice_answers_session ON practice_answers(session_id);

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
CREATE INDEX idx_feedback_resolved ON question_feedback(is_resolved);
```

---

## Database Functions & Triggers

### 1. Auto-update `updated_at` Timestamp

```sql
-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add similar triggers for other tables with updated_at
```

### 2. Auto-populate Denormalized Fields in Questions

```sql
-- Trigger to populate grade_level_id and subject_id when question is inserted
CREATE OR REPLACE FUNCTION populate_question_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  SELECT s.id, s.grade_level_id INTO NEW.subject_id, NEW.grade_level_id
  FROM topics t
  JOIN subjects s ON t.subject_id = s.id
  WHERE t.id = NEW.topic_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER populate_question_hierarchy_trigger
  BEFORE INSERT OR UPDATE OF topic_id ON questions
  FOR EACH ROW EXECUTE FUNCTION populate_question_hierarchy();
```

### 3. Refresh Question Statistics (Materialized View)

```sql
-- Function to refresh question statistics (call via pg_cron or scheduled function)
-- Recommended: every 5-15 minutes for small/medium apps
CREATE OR REPLACE FUNCTION refresh_question_statistics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
END;
$$ language 'plpgsql';

-- Optional: Schedule with pg_cron (if enabled in Supabase)
-- SELECT cron.schedule('refresh-question-stats', '*/5 * * * *', 'SELECT refresh_question_statistics()');
```

### 4. Update Student XP and Level

```sql
-- Constants
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(xp / 500) + 1;
END;
$$ language 'plpgsql';

-- Function to award XP and coins after session completion
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

  -- Update student profile
  UPDATE student_profiles SET
    xp = xp + v_total_xp,
    coins = coins + v_total_coins,
    level = calculate_level(xp + v_total_xp)
  WHERE id = v_student_id;

  -- Mark today as practiced
  INSERT INTO daily_statuses (student_id, date, has_practiced)
  VALUES (v_student_id, CURRENT_DATE, TRUE)
  ON CONFLICT (student_id, date) DO UPDATE SET
    has_practiced = TRUE,
    updated_at = NOW();
END;
$$ language 'plpgsql';
```

### 5. Gacha Pet Pull Function

```sql
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

  -- Determine rarity based on probabilities (60% common, 30% rare, 9% epic, 1% legendary)
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

  -- Add to owned pets
  INSERT INTO owned_pets (student_id, pet_id, count)
  VALUES (p_student_id, v_selected_pet_id, 1)
  ON CONFLICT (student_id, pet_id) DO UPDATE SET count = owned_pets.count + 1;

  RETURN v_selected_pet_id;
END;
$$ language 'plpgsql';
```

### 6. Refresh All Materialized Views

```sql
-- Function to refresh all materialized views (call periodically via cron)
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY question_statistics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard;
END;
$$ language 'plpgsql';

-- Optional: Schedule with pg_cron (if enabled in Supabase)
-- SELECT cron.schedule('refresh-views', '*/5 * * * *', 'SELECT refresh_all_materialized_views()');
```

### 7. Calculate Streak

```sql
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
$$ language 'plpgsql';
```

### 8. Handle New User Signup

```sql
-- Trigger function to create profile and type-specific profile on signup
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
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## Entity Relationship Diagram (Text)

```
┌─────────────────┐
│   auth.users    │ (Supabase managed)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    profiles     │◄──────────────────────────────────────┐
├─────────────────┤                                        │
│ id (PK, FK)     │                                        │
│ name            │                                        │
│ email           │                                        │
│ user_type       │                                        │
│ avatar_url      │                                        │
└────────┬────────┘                                        │
         │                                                 │
    ┌────┴────┬────────────────┐                          │
    ▼         ▼                ▼                          │
┌─────────┐ ┌─────────┐ ┌─────────────┐                   │
│student_ │ │parent_  │ │(admin has   │                   │
│profiles │ │profiles │ │no extra     │                   │
└────┬────┘ └─────────┘ │profile)     │                   │
     │                  └─────────────┘                   │
     │                                                    │
     ├──────────────────┐                                 │
     │                  │                                 │
     ▼                  ▼                                 │
┌──────────┐    ┌──────────────┐                         │
│owned_pets│    │daily_statuses│                         │
└────┬─────┘    └──────────────┘                         │
     │                                                    │
     ▼                                                    │
┌─────────┐                                               │
│  pets   │                                               │
└─────────┘                                               │
                                                          │
┌─────────────────────────────────────────────────────────┼───┐
│                    CURRICULUM                           │   │
│                                                         │   │
│  ┌─────────────┐      ┌──────────┐      ┌────────┐     │   │
│  │grade_levels │─────►│ subjects │─────►│ topics │     │   │
│  └─────────────┘      └──────────┘      └───┬────┘     │   │
│                                             │          │   │
└─────────────────────────────────────────────┼──────────┘   │
                                              │              │
                                              ▼              │
                                        ┌───────────┐        │
                                        │ questions │        │
                                        │(with MCQ  │        │
                                        │ options)  │        │
                                        └─────┬─────┘        │
                                              │              │
                           ┌──────────────────┼──────────────┤
                           │                  │              │
                           ▼                  ▼              │
                  ┌────────────────┐   ┌──────────┐          │
                  │question_       │   │question_ │──────────┘
                  │statistics      │   │feedback  │
                  └────────────────┘   └──────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PRACTICE SESSIONS                                 │
│                                                                      │
│  student_profiles ────► practice_sessions ────► session_questions   │
│                              │                       │               │
│                              │                       ▼               │
│                              └──────────────► practice_answers       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PARENT-STUDENT LINKING                            │
│                                                                      │
│  profiles (parent) ◄───► parent_student_invitations ◄───► profiles  │
│         │                                                    │       │
│         └────────────► parent_student_links ◄────────────────┘       │
│                              │                                       │
│                              ▼                                       │
│                     child_subscriptions                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Seed Data

### Default Subscription Plans

```sql
INSERT INTO subscription_plans (id, name, price_monthly, sessions_per_day, features, is_highlighted) VALUES
  ('basic', 'Basic', 0.00, 3, '["3 practice sessions per day", "Basic progress tracking", "Access to all subjects"]', FALSE),
  ('plus', 'Plus', 9.99, 10, '["10 practice sessions per day", "Detailed progress reports", "Priority support"]', FALSE),
  ('pro', 'Pro', 19.99, 25, '["25 practice sessions per day", "Advanced analytics", "Downloadable reports", "Priority support"]', TRUE),
  ('max', 'Max', 29.99, 50, '["50 practice sessions per day", "All Pro features", "1-on-1 tutoring sessions", "Custom curriculum"]', FALSE);
```

### Default Pets

```sql
INSERT INTO pets (name, rarity, image_emoji, gacha_weight) VALUES
  -- Common (60% total = ~10% each)
  ('Hamster', 'common', '🐹', 100),
  ('Chick', 'common', '🐤', 100),
  ('Bunny', 'common', '🐰', 100),
  ('Puppy', 'common', '🐶', 100),
  ('Kitten', 'common', '🐱', 100),
  ('Piglet', 'common', '🐷', 100),
  -- Rare (30% total = ~6% each)
  ('Fox', 'rare', '🦊', 60),
  ('Panda', 'rare', '🐼', 60),
  ('Koala', 'rare', '🐨', 60),
  ('Penguin', 'rare', '🐧', 60),
  ('Owl', 'rare', '🦉', 60),
  -- Epic (9% total = ~3% each)
  ('Unicorn', 'epic', '🦄', 30),
  ('Dragon', 'epic', '🐉', 30),
  ('Phoenix', 'epic', '🔥', 30),
  -- Legendary (1% total = ~0.5% each)
  ('Golden Dragon', 'legendary', '✨🐉', 5),
  ('Celestial Fox', 'legendary', '💫🦊', 5);
```

---

## Notes

1. **Timestamps**: All tables use `TIMESTAMPTZ` for timezone-aware timestamps
2. **UUIDs**: All primary keys use `UUID` with `gen_random_uuid()` for generation
3. **Soft Deletes**: Not implemented; use hard deletes with CASCADE where appropriate
4. **Images**: Store file paths in database, actual files in Supabase Storage buckets
5. **Materialized Views**: Leaderboard is a materialized view for performance; refresh periodically
6. **Security**: RLS policies ensure data isolation between users
7. **Triggers**: Automatic updates for timestamps, statistics, and hierarchy denormalization
8. **Immutable Questions**: Questions cannot be edited, only deleted and recreated. This ensures:
   - Question statistics remain accurate (attempts were for the exact question)
   - Student history is preserved (answer records remain with `question_id = NULL`)
   - UI should show "Question no longer available" when `question_id` is `NULL`
