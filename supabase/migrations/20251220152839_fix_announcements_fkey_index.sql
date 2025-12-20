-- Add index for announcements.created_by foreign key
CREATE INDEX idx_announcements_created_by ON announcements(created_by);
