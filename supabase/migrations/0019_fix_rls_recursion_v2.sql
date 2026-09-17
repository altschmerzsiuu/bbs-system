-- 0019_fix_rls_recursion_v2.sql

-- 1. Create narrowly scoped SECURITY DEFINER helpers for RLS predicates
-- These functions break plan-time circular dependencies in RLS.

create or replace function authz_is_booking_participant(p_booking_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  return exists (
    select 1 from booking_participants bp 
    where bp.booking_id = p_booking_id and bp.member_id = current_member_id()
  );
end $$;
revoke all on function authz_is_booking_participant(uuid) from public;
grant execute on function authz_is_booking_participant(uuid) to authenticated, anon;

create or replace function authz_groomer_can_access_booking(p_booking_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  return current_app_role() = 'GROOMER' and exists (
    select 1 from bookings b
    join session_slots s on s.id = b.slot_id
    where b.id = p_booking_id
      and s.slot_date between current_date - 1 and current_date + 7
  );
end $$;
revoke all on function authz_groomer_can_access_booking(uuid) from public;
grant execute on function authz_groomer_can_access_booking(uuid) to authenticated, anon;

create or replace function authz_groomer_can_access_member(p_member_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  return current_app_role() = 'GROOMER' and exists (
    select 1 from booking_participants bp
    join bookings b on b.id = bp.booking_id
    join session_slots s on s.id = b.slot_id
    where bp.member_id = p_member_id and s.slot_date = current_date
  );
end $$;
revoke all on function authz_groomer_can_access_member(uuid) from public;
grant execute on function authz_groomer_can_access_member(uuid) to authenticated, anon;


-- 2. Drop and recreate policies with helpers

drop policy if exists members_self on members;
create policy members_self on members for select
  using (
    case 
      when user_id = auth.uid() then true
      when is_admin() then true
      when authz_groomer_can_access_member(id) then true
      else false
    end
  );

drop policy if exists participants_read on booking_participants;
create policy participants_read on booking_participants for select using (
  case 
    when is_admin() then true
    when member_id = current_member_id() then true
    when authz_groomer_can_access_booking(booking_id) then true
    else false
  end
);

drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select using (
  case 
    when is_admin() then true
    when authz_is_booking_participant(id) then true
    when authz_groomer_can_access_booking(id) then true
    else false
  end
);
