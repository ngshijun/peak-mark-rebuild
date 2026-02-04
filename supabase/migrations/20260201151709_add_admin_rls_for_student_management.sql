-- Add admin read access to child_subscriptions
CREATE POLICY "Admins can view all child subscriptions"
ON child_subscriptions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'
  )
);

-- Add admin read access to parent_student_links
CREATE POLICY "Admins can view all parent student links"
ON parent_student_links FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
    AND profiles.user_type = 'admin'
  )
);
