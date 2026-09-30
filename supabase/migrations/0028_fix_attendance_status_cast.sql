create or replace function resolve_attendance(
  p_participant_id uuid, p_status attendance_status, p_credit_action text,
  p_reason text, p_actor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  p record;
  v_booking bookings%rowtype;
begin
  select bp.*, b.id as bid into p
  from booking_participants bp join bookings b on b.id = bp.booking_id
  where bp.id = p_participant_id for update;
  if not found then perform raise_domain_error('PARTICIPANT_NOT_FOUND'); end if;

  select * into v_booking from bookings where id = p.bid for update;
  if v_booking.status <> 'CONFIRMED' then perform raise_domain_error('INVALID_BOOKING_STATUS'); end if;

  if p.participant_type = 'MEMBER' then
    perform 1 from memberships where id = p.membership_id for update;
    if p_status = 'ATTENDED' then
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, delta_consumed, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'SESSION_COMPLETED', -1, 1, p_reason, p_actor_id);
    elsif p_credit_action = 'CONSUMED' then
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, delta_consumed, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'NO_SHOW_DEDUCT', -1, 1, p_reason, p_actor_id);
    else
      insert into membership_credit_ledger
        (membership_id, member_id, booking_id, participant_id, txn_type,
         delta_reserved, reason, actor_id)
      values (p.membership_id, p.member_id, p.bid, p.id, 'NO_SHOW_RETURN', -1, p_reason, p_actor_id);
    end if;
  end if;

  insert into attendance_records
    (booking_id, participant_id, status, credit_action, reason, resolved_by)
  values (p.bid, p.id, p_status,
          case when p.participant_type = 'CASUAL' then 'NOT_APPLICABLE' else p_credit_action end,
          p_reason, p_actor_id);

  -- The booking closes once every participant has been resolved.
  if not exists (
    select 1 from booking_participants bp
    left join attendance_records ar on ar.participant_id = bp.id
    where bp.booking_id = p.bid and ar.id is null
  ) then
    update bookings set status =
      (case when exists (select 1 from attendance_records
                        where booking_id = p.bid and status = 'ATTENDED')
           then 'COMPLETED' else 'NO_SHOW' end)::booking_status,
      updated_at = now()
    where id = p.bid;
    insert into booking_status_history (booking_id, from_status, to_status, actor_id, reason)
    select p.bid, 'CONFIRMED', status, p_actor_id, 'attendance resolved'
    from bookings where id = p.bid;
  end if;
end $$;
