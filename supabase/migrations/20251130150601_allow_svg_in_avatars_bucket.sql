-- Update avatars bucket to allow SVG mime type
UPDATE storage.buckets
SET allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
WHERE id = 'avatars';
