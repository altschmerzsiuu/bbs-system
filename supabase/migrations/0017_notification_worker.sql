-- 0017_notification_worker.sql

-- ---------------------------------------------------------------------------
-- claim_pending_notifications
-- Atomically claims a batch of pending notifications.
-- Updates 'attempts' and sets a 5-minute lease via 'available_at'.
-- ---------------------------------------------------------------------------
create or replace function claim_pending_notifications(p_batch_size int)
returns setof notification_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    select id
    from notification_outbox
    where status = 'PENDING'
      and available_at <= now()
    order by created_at asc
    limit p_batch_size
    for update skip locked
  )
  update notification_outbox n
  set attempts = n.attempts + 1,
      -- 5-minute lease. If the worker crashes, the row becomes available again.
      available_at = now() + interval '5 minutes'
  from claimed c
  where n.id = c.id
  returning n.*;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_notification_sent
-- Finalizes a notification as SENT.
-- Requires matching 'attempts' to protect against stale/concurrent worker updates.
-- ---------------------------------------------------------------------------
create or replace function mark_notification_sent(p_id uuid, p_attempts int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_rows_affected int;
begin
  update notification_outbox
  set status = 'SENT', sent_at = now()
  where id = p_id and status = 'PENDING' and attempts = p_attempts;
  
  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_notification_failed
-- Finalizes or retries a notification.
-- Requires matching 'attempts' to protect against stale/concurrent worker updates.
-- ---------------------------------------------------------------------------
create or replace function mark_notification_failed(
  p_id uuid, 
  p_attempts int, 
  p_error text, 
  p_is_permanent boolean,
  p_max_attempts int
)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_rows_affected int;
begin
  if p_is_permanent or p_attempts >= p_max_attempts then
    update notification_outbox
    set status = 'FAILED', last_error = p_error
    where id = p_id and status = 'PENDING' and attempts = p_attempts;
  else
    update notification_outbox
    set status = 'PENDING',
        last_error = p_error,
        -- Exponential backoff: 2^attempts minutes.
        available_at = now() + (power(2, p_attempts) || ' minutes')::interval
    where id = p_id and status = 'PENDING' and attempts = p_attempts;
  end if;

  get diagnostics v_rows_affected = row_count;
  return v_rows_affected > 0;
end;
$$;
