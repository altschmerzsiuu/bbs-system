ALTER TABLE booking_participants DROP CONSTRAINT participant_identity_valid;

ALTER TABLE booking_participants ADD CONSTRAINT participant_identity_valid CHECK (
    (participant_type = 'MEMBER'
      and member_id is not null and casual_customer_id is null)
    or
    (participant_type = 'CASUAL'
      and casual_customer_id is not null and member_id is null and membership_id is null)
);
