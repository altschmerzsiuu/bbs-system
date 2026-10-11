-- 0051_enable_realtime_replica_identity.sql
-- Enable REPLICA IDENTITY FULL on all core realtime tables so UPDATE/DELETE events
-- can be evaluated by Supabase Realtime under Row Level Security (RLS) for members.

-- 1. Set REPLICA IDENTITY FULL so WAL contains full rows for UPDATE events
alter table public.bookings replica identity full;
alter table public.booking_participants replica identity full;
alter table public.session_slots replica identity full;
alter table public.riding_requests replica identity full;
alter table public.membership_applications replica identity full;
alter table public.memberships replica identity full;
alter table public.notifications replica identity full;

-- 2. Add missing tables to supabase_realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'booking_participants'
  ) then
    alter publication supabase_realtime add table public.booking_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'session_slots'
  ) then
    alter publication supabase_realtime add table public.session_slots;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'memberships'
  ) then
    alter publication supabase_realtime add table public.memberships;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- 3. Enhance bookings_read and participants_read RLS policies for instant owner matching
drop policy if exists bookings_read on public.bookings;
create policy bookings_read on public.bookings for select using (
  case 
    when is_admin() then true
    when created_by = auth.uid() then true
    when authz_is_booking_participant(id) then true
    when authz_groomer_can_access_booking(id) then true
    else false
  end
);

drop policy if exists participants_read on public.booking_participants;
create policy participants_read on public.booking_participants for select using (
  case 
    when is_admin() then true
    when member_id = current_member_id() then true
    when exists (
      select 1 from public.bookings b 
      where b.id = booking_participants.booking_id and b.created_by = auth.uid()
    ) then true
    when authz_groomer_can_access_booking(booking_id) then true
    else false
  end
);
