-- 0008_rls.sql — Section 45. Deny by default; every mutation goes through a
-- server-side SECURITY DEFINER function, never a direct client write.
alter table users                      enable row level security;
alter table members                    enable row level security;
alter table membership_plans           enable row level security;
alter table memberships                enable row level security;
alter table membership_credit_ledger   enable row level security;
alter table operating_schedules        enable row level security;
alter table schedule_overrides         enable row level security;
alter table session_slots              enable row level security;
alter table bookings                   enable row level security;
alter table booking_participants       enable row level security;
alter table booking_status_history     enable row level security;
alter table booking_slot_history       enable row level security;
alter table attendance_records         enable row level security;
alter table casual_customers           enable row level security;
alter table renewal_requests           enable row level security;
alter table payment_orders             enable row level security;
alter table payment_transactions       enable row level security;
alter table notifications              enable row level security;
alter table user_devices               enable row level security;
alter table system_settings            enable row level security;
alter table audit_logs                 enable row level security;
alter table integration_sync_jobs      enable row level security;

-- users -----------------------------------------------------------------
create policy users_self_select on users for select using (id = auth.uid() or is_admin());
create policy users_self_update on users for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from users u where u.id = auth.uid()));
create policy users_admin_all on users for all using (is_admin()) with check (is_admin());

-- members ---------------------------------------------------------------
create policy members_self on members for select
  using (user_id = auth.uid() or is_admin()
         or (current_app_role() = 'GROOMER' and exists (
              select 1 from booking_participants bp
              join bookings b on b.id = bp.booking_id
              join session_slots s on s.id = b.slot_id
              where bp.member_id = members.id and s.slot_date = current_date)));
create policy members_admin on members for all using (is_admin()) with check (is_admin());

-- plans & slots are public read (Section 4: guests may browse) -----------
create policy plans_public_read on membership_plans for select using (is_active or is_admin());
create policy plans_admin on membership_plans for all using (is_admin()) with check (is_admin());
create policy slots_public_read on session_slots for select using (true);
create policy slots_admin on session_slots for all using (is_admin()) with check (is_admin());
create policy schedules_public_read on operating_schedules for select using (true);
create policy schedules_admin on operating_schedules for all using (is_admin()) with check (is_admin());
create policy overrides_read on schedule_overrides for select using (true);
create policy overrides_admin on schedule_overrides for all using (is_admin()) with check (is_admin());

-- memberships & credits: strictly owner or admin (groomer excluded) ------
create policy memberships_owner on memberships for select
  using (member_id = current_member_id() or is_admin());
create policy memberships_admin on memberships for all using (is_admin()) with check (is_admin());
create policy ledger_owner on membership_credit_ledger for select
  using (member_id = current_member_id() or is_admin());
create policy ledger_admin on membership_credit_ledger for all using (is_admin()) with check (is_admin());

-- bookings --------------------------------------------------------------
create policy bookings_read on bookings for select using (
  is_admin()
  or exists (select 1 from booking_participants bp
             where bp.booking_id = bookings.id and bp.member_id = current_member_id())
  or (current_app_role() = 'GROOMER' and exists (
        select 1 from session_slots s where s.id = bookings.slot_id
          and s.slot_date between current_date - 1 and current_date + 7))
);
create policy bookings_admin on bookings for all using (is_admin()) with check (is_admin());

create policy participants_read on booking_participants for select using (
  is_admin() or member_id = current_member_id()
  or (current_app_role() = 'GROOMER' and exists (
        select 1 from bookings b join session_slots s on s.id = b.slot_id
        where b.id = booking_participants.booking_id
          and s.slot_date between current_date - 1 and current_date + 7))
);
create policy participants_admin on booking_participants for all using (is_admin()) with check (is_admin());

create policy status_history_read on booking_status_history for select using (
  is_admin() or exists (select 1 from booking_participants bp
    where bp.booking_id = booking_status_history.booking_id and bp.member_id = current_member_id()));
create policy slot_history_read on booking_slot_history for select using (
  is_admin() or exists (select 1 from booking_participants bp
    where bp.booking_id = booking_slot_history.booking_id and bp.member_id = current_member_id()));
create policy attendance_read on attendance_records for select using (
  is_admin() or current_app_role() = 'GROOMER'
  or exists (select 1 from booking_participants bp
    where bp.id = attendance_records.participant_id and bp.member_id = current_member_id()));
create policy attendance_admin on attendance_records for all using (is_admin()) with check (is_admin());

-- casual customers: admin only (contains contact details) ----------------
create policy casual_admin on casual_customers for all using (is_admin()) with check (is_admin());

-- renewals & payments: owner read, admin write --------------------------
create policy renewals_owner on renewal_requests for select
  using (member_id = current_member_id() or is_admin());
create policy renewals_admin on renewal_requests for all using (is_admin()) with check (is_admin());
create policy payment_orders_owner on payment_orders for select
  using (member_id = current_member_id() or is_admin());
create policy payment_orders_admin on payment_orders for all using (is_admin()) with check (is_admin());
create policy payment_txn_admin on payment_transactions for all using (is_admin()) with check (is_admin());

-- notifications & devices ------------------------------------------------
create policy notifications_owner on notifications for select using (user_id = auth.uid() or is_admin());
create policy notifications_mark_read on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_owner on user_devices for all
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

-- settings / audit / sync: admin only ------------------------------------
create policy settings_read on system_settings for select using (auth.uid() is not null);
create policy settings_admin on system_settings for all using (is_admin()) with check (is_admin());
create policy audit_admin on audit_logs for all using (is_admin()) with check (is_admin());
create policy sync_admin on integration_sync_jobs for all using (is_admin()) with check (is_admin());
