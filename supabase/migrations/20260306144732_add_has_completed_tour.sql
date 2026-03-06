-- Add tour completion tracking to profiles (shared by student + parent)
ALTER TABLE profiles
  ADD COLUMN has_completed_tour BOOLEAN NOT NULL DEFAULT FALSE;
