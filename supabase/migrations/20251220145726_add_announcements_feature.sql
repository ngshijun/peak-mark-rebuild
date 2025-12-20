-- =============================================================================
-- Announcements Feature Migration
-- =============================================================================

-- Create enum for target audience
CREATE TYPE announcement_audience AS ENUM ('all', 'students_only', 'parents_only');

-- =============================================================================
-- TABLES
-- =============================================================================

-- Announcements table
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience announcement_audience NOT NULL DEFAULT 'all',
  image_path TEXT,
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcement read tracking (per-user)
CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_announcements_target_audience ON announcements(target_audience);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcement_reads_user_id ON announcement_reads(user_id);
CREATE INDEX idx_announcement_reads_announcement_id ON announcement_reads(announcement_id);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- Announcements: Read access based on user type and expiry
CREATE POLICY "Authenticated users can view relevant announcements" ON announcements
  FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > NOW())
    AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin')
      OR (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'student')
          AND target_audience IN ('all', 'students_only'))
      OR (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'parent')
          AND target_audience IN ('all', 'parents_only'))
    )
  );

-- Admins can insert announcements
CREATE POLICY "Admins can insert announcements" ON announcements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin'));

-- Admins can update announcements
CREATE POLICY "Admins can update announcements" ON announcements
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin'));

-- Admins can delete announcements
CREATE POLICY "Admins can delete announcements" ON announcements
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin'));

-- Announcement reads: Users can view their own read status
CREATE POLICY "Users can view own announcement read status" ON announcement_reads
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can mark announcements as read
CREATE POLICY "Users can mark announcements as read" ON announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
);

-- Storage policies for announcement images
CREATE POLICY "Announcement images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcement-images');

CREATE POLICY "Admins can upload announcement images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'announcement-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin')
  );

CREATE POLICY "Admins can update announcement images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'announcement-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin')
  );

CREATE POLICY "Admins can delete announcement images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'announcement-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'admin')
  );

-- =============================================================================
-- RPC FUNCTION FOR UNREAD COUNT
-- =============================================================================

CREATE OR REPLACE FUNCTION get_unread_announcement_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM announcements a
  WHERE
    (a.expires_at IS NULL OR a.expires_at > NOW())
    AND (
      (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'student')
       AND a.target_audience IN ('all', 'students_only'))
      OR (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND user_type = 'parent')
          AND a.target_audience IN ('all', 'parents_only'))
    )
    AND NOT EXISTS (
      SELECT 1 FROM announcement_reads ar
      WHERE ar.announcement_id = a.id AND ar.user_id = (SELECT auth.uid())
    );
$$;
