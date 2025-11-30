-- Add INSERT policies for profile tables
-- Users need to be able to create their own profile on first login

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow students to insert their own student profile
CREATE POLICY "Students can insert own student profile"
  ON student_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow parents to insert their own parent profile
CREATE POLICY "Parents can insert own parent profile"
  ON parent_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
