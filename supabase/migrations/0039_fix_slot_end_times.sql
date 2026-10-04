-- Fix slots that have incorrect end_times (e.g., spanning 4-5 hours instead of 45/60 mins)
UPDATE session_slots
SET end_time = (start_time + interval '45 minutes')
WHERE (EXTRACT(EPOCH FROM (end_time - start_time)) / 60) > 60;

-- Clear dummy data from mockups
TRUNCATE TABLE membership_applications CASCADE;
TRUNCATE TABLE riding_requests CASCADE;
