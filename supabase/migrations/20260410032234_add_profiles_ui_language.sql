-- Add ui_language column to profiles for UI i18n preference.
-- Distinct from student_profiles.preferred_language (which controls AI session summary language).
ALTER TABLE profiles
  ADD COLUMN ui_language text NOT NULL DEFAULT 'en'
  CHECK (ui_language IN ('en', 'zh'));
