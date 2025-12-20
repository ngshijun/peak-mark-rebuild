-- =============================================================================
-- Add is_pinned column to announcements
-- =============================================================================

-- Add is_pinned column with default false
ALTER TABLE announcements ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Create index for pinned announcements (for efficient sorting)
CREATE INDEX idx_announcements_is_pinned ON announcements(is_pinned DESC);
