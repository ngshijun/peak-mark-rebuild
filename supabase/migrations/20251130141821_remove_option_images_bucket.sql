-- Remove unused option-images bucket
-- All images (question and option) are stored in the question-images bucket

DELETE FROM storage.buckets WHERE id = 'option-images';
