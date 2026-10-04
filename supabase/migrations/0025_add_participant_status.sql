create type participant_booking_status as enum (
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'NO_SHOW',
  'COMPLETED',
  'RESCHEDULE_REQUESTED'
);

alter table booking_participants
add column participant_status participant_booking_status;

update booking_participants bp
set participant_status =
  case b.status
    when 'PENDING' then 'PENDING'::participant_booking_status
    when 'CONFIRMED' then 'CONFIRMED'::participant_booking_status
    when 'COMPLETED' then 'COMPLETED'::participant_booking_status
    when 'NO_SHOW' then 'NO_SHOW'::participant_booking_status
    when 'RESCHEDULE_REQUESTED' then 'RESCHEDULE_REQUESTED'::participant_booking_status
    when 'MEMBER_CANCELLED' then 'CANCELLED'::participant_booking_status
    when 'BBS_CANCELLED' then 'CANCELLED'::participant_booking_status
    when 'REJECTED' then 'CANCELLED'::participant_booking_status
    when 'EXPIRED' then 'CANCELLED'::participant_booking_status
    else 'CANCELLED'::participant_booking_status
  end
from bookings b
where b.id = bp.booking_id;

alter table booking_participants
alter column participant_status set default 'PENDING';

alter table booking_participants
alter column participant_status set not null;