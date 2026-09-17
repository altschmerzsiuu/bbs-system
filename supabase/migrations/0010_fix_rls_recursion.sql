-- Fix infinite recursion by using CASE for short-circuiting in RLS

drop policy if exists members_self on members;
create policy members_self on members for select
  using (
    case 
      when user_id = auth.uid() then true
      when is_admin() then true
      when current_app_role() = 'GROOMER' then 
        exists (
          select 1 from booking_participants bp
          join bookings b on b.id = bp.booking_id
          join session_slots s on s.id = b.slot_id
          where bp.member_id = members.id and s.slot_date = current_date
        )
      else false
    end
  );

drop policy if exists participants_read on booking_participants;
create policy participants_read on booking_participants for select using (
  case 
    when is_admin() then true
    when member_id = current_member_id() then true
    when current_app_role() = 'GROOMER' then
      exists (
        select 1 from bookings b join session_slots s on s.id = b.slot_id
        where b.id = booking_participants.booking_id
          and s.slot_date between current_date - 1 and current_date + 7
      )
    else false
  end
);

drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select using (
  case 
    when is_admin() then true
    when exists (select 1 from booking_participants bp where bp.booking_id = bookings.id and bp.member_id = current_member_id()) then true
    when current_app_role() = 'GROOMER' then
      exists (
        select 1 from session_slots s where s.id = bookings.slot_id
          and s.slot_date between current_date - 1 and current_date + 7
      )
    else false
  end
);
