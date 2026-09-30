-- 0022_membership_applications_insert_policy.sql

-- Enable members to submit their own membership applications during onboarding
CREATE POLICY membership_applications_insert ON membership_applications FOR INSERT
  WITH CHECK (member_id = current_member_id());
