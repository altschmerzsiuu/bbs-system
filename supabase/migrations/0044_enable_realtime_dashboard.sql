-- 0044_enable_realtime_dashboard.sql

-- Enable Realtime publication for tables needed in the Admin & Member Dashboard
-- Using DO block to avoid errors if they are already in the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'membership_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE membership_applications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'riding_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE riding_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  END IF;
END $$;
