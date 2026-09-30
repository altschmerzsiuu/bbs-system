import { createServerClient } from '@/infrastructure/supabase-server';

import type {
  BookingStatus,
  MemberHomeState,
  MemberHomeViewModel,
  AdminScheduleParticipant,
  AdminScheduleBooking,
  AdminScheduleSlot,
  AdminSessionDetail,
  AdminSessionDetailBooking,
} from './booking-types';

export async function getMemberHome(memberId: string): Promise<MemberHomeViewModel> {
  const db = await createServerClient();

  // Fetch all necessary pieces in parallel
  const [memberRes, activeMembershipRes, expiredMembershipRes, notifRes, appRes, bookingRes, recentRidesRes, ridingRequestRes] = await Promise.all([
    db.from('members').select('full_name').eq('id', memberId).single(),

    db.from('memberships')
      .select('id, allocated_credits, end_date, membership_plans(name)')
      .eq('member_id', memberId)
      .eq('status', 'ACTIVE')
      .maybeSingle(),

    db.from('memberships')
      .select('id, allocated_credits, end_date, membership_plans(name)')
      .eq('member_id', memberId)
      .eq('status', 'EXPIRED')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),

    db.from('membership_applications')
      .select('id, status, application_type, final_price_idr, membership_plans(name)')
      .eq('member_id', memberId)
      .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED', 'PENDING_ACTIVATION'])
      .maybeSingle(),

    db.from('booking_participants')
      .select(`
        booking_id,
        bookings!inner (
          id, status,
          session_slots!bookings_slot_id_fkey!inner ( slot_date, start_time, end_time ),
          booking_participants ( members ( full_name ), casual_customers ( full_name ) )
        )
      `)
      .eq('member_id', memberId)
      .in('bookings.status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'])
      .gte('bookings.session_slots.slot_date', new Date().toISOString().slice(0, 10))
      .order('slot_date', { referencedTable: 'bookings.session_slots', ascending: true }),
      
    db.from('booking_participants')
      .select(`
        id,
        horses ( name ),
        bookings!inner (
          session_slots!inner ( slot_date )
        )
      `)
      .eq('member_id', memberId)
      .eq('attendance_status', 'ATTENDED')
      .not('horse_id', 'is', null)
      .limit(5),

    db.from('riding_requests')
      .select('id, request_type, status, preferred_date, preferred_time_start')
      .eq('member_id', memberId)
      .in('status', ['PENDING', 'APPROVED', 'FAILED', 'REJECTED'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const activeRow = activeMembershipRes.data as any;
  const expiredRow = expiredMembershipRes.data as any;
  const appData = appRes.data as any;
  const bookings = (bookingRes.data ?? []) as any[];
  const recentRidesData = (recentRidesRes.data ?? []) as any[];

  let resolvedMembership = null;
  let resolvedState: MemberHomeState = "NO_MEMBERSHIP"; // Default to S1

  // Determine ACTIVE membership and credits
  if (activeRow) {
    const { data: state } = await db.rpc('membership_credit_state', { p_membership_id: activeRow.id });
    const s = Array.isArray(state) ? state[0] : state;
    const available = s?.available ?? 0;

    resolvedMembership = {
      plan: activeRow.membership_plans?.name ?? '—',
      allocated: activeRow.allocated_credits,
      used: (s?.reserved ?? 0) + (s?.consumed ?? 0),
      available,
      endDate: activeRow.end_date,
    };

    if (appData?.status === 'PENDING_ACTIVATION') {
      resolvedState = "ACTIVE_WITH_RENEWAL"; // S8
    } else if (available > 0) {
      resolvedState = "ACTIVE"; // S5
    } else {
      resolvedState = "ACTIVE_NO_CREDITS"; // S6
    }
  } else if (appData) {
    // No active membership, but there is an application
    if (appData.status === 'PENDING_REVIEW') {
      resolvedState = "APPLICATION_PENDING"; // S2
    } else if (appData.status === 'APPROVED') {
      resolvedState = "PAYMENT_PENDING"; // S3
    } else if (appData.status === 'PAYMENT_CONFIRMED') {
      resolvedState = "ACTIVATION_PENDING"; // S4
    }
  } else if (expiredRow) {
    // No active membership, no application, but has expired membership
    resolvedMembership = {
      plan: expiredRow.membership_plans?.name ?? '—',
      allocated: expiredRow.allocated_credits,
      used: expiredRow.allocated_credits, // just for show
      available: 0,
      endDate: expiredRow.end_date,
    };
    resolvedState = "EXPIRED"; // S7
  }
  
  const now = new Date();
  const validUpcomingBookings = bookings.filter((b: any) => {
    const slot = b.bookings.session_slots;
    const [year, month, day] = slot.slot_date.split('-').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const endTime = new Date(year, month - 1, day, endH, endM, 0, 0);
    return endTime > now;
  });

  const first = validUpcomingBookings[0]?.bookings;

  return {
    state: resolvedState,
    memberName: memberRes.data?.full_name ?? 'Rider',
    membership: resolvedMembership,
    application: appData
      ? {
        id: appData.id,
        status: appData.status,
        type: appData.application_type,
        planName: appData.membership_plans?.name ?? 'Plan',
        finalPrice: appData.final_price_idr,
      }
      : null,
    nextBooking: first
      ? {
        id: first.id,
        date: first.session_slots.slot_date,
        startTime: first.session_slots.start_time.slice(0, 5),
        endTime: first.session_slots.end_time.slice(0, 5),
        status: first.status,
        sharedWith: (first.booking_participants ?? [])
          .map((p: any) => p.members?.full_name ?? p.casual_customers?.full_name)
          .filter((n: string | undefined): n is string => Boolean(n) && n !== memberRes.data?.full_name),
      }
      : null,
    upcomingCount: validUpcomingBookings.length,
    unreadNotifications: notifRes.count ?? 0,
    recentRides: recentRidesData.map((r: any) => ({
      id: r.id,
      date: r.bookings?.session_slots?.slot_date ?? '',
      horseName: r.horses?.name ?? null,
    })),
    pendingRideRequest: ridingRequestRes.data ? {
      id: ridingRequestRes.data.id,
      type: ridingRequestRes.data.request_type,
      status: ridingRequestRes.data.status,
      preferredDate: ridingRequestRes.data.preferred_date,
      preferredTime: ridingRequestRes.data.preferred_time_start
    } : null,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export async function getAdminSchedule(
  date: string
): Promise<AdminScheduleSlot[]> {
  const db = await createServerClient();

  /*
   * 1. Determine day of week.
   *
   * JS: Sunday = 0 ... Saturday = 6
   * This matches operating_schedules.day_of_week.
   */
  const selectedDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = selectedDate.getDay();

  /*
   * 2. Fetch operating schedules and existing session slots
   *    for this date in parallel.
   */
  const [scheduleRes, slotsRes, requestsRes] = await Promise.all([
    db
      .from('operating_schedules')
      .select(`
        id,
        day_of_week,
        block,
        start_time,
        end_time,
        session_duration_minutes,
        slot_interval_minutes,
        default_capacity,
        is_active
      `)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('start_time', { ascending: true }),

    db
      .from('session_slots')
      .select(`
        id,
        slot_date,
        start_time,
        end_time,
        block,
        capacity,
        is_open,
        closed_reason,
        bookings!bookings_slot_id_fkey (
          id,
          status,
          notes,
          booking_participants (
            id,
            participant_type,
            member_id,
            membership_id,
            casual_customer_id,
            members (
              full_name,
              user_id,
              users (
                avatar_url
              )
            ),
            casual_customers (
              full_name
            )
          )
        )
      `)
      .eq('slot_date', date)
      .order('start_time', { ascending: true }),
      
    db
      .from('riding_requests')
      .select(`
        id,
        request_type,
        status,
        preferred_time_start,
        members ( full_name )
      `)
      .eq('preferred_date', date)
      .eq('status', 'UNDER_REVIEW')
  ]);

  if (scheduleRes.error) {
    console.error('[getAdminSchedule] operating_schedules:', scheduleRes.error);
    throw new Error('FAILED_TO_LOAD_OPERATING_SCHEDULE');
  }

  if (slotsRes.error) {
    console.error('[getAdminSchedule] session_slots:', slotsRes.error);
    throw new Error('FAILED_TO_LOAD_ADMIN_SCHEDULE');
  }

  if (requestsRes?.error) {
    console.error('[getAdminSchedule] riding_requests:', requestsRes.error);
  }

  const operatingSchedules = scheduleRes.data ?? [];
  const sessionSlots = slotsRes.data ?? [];
  const ridingRequests = requestsRes?.data ?? [];

  /*
   * 3. Build a quick lookup map for existing session slots and riding requests.
   *
   * Key:
   *   block + start_time
   *
   * Example:
   *   AFTERNOON|16:00:00
   */
  const slotMap = new Map<string, any>();
  const requestMap = new Map<string, any[]>();
  
  for (const req of ridingRequests as any[]) {
    // We group requests by preferred_time_start. 
    // They don't have block natively, so we just group by time
    const timeKey = req.preferred_time_start?.slice(0, 5); // "HH:MM"
    if (!timeKey) continue;
    
    if (!requestMap.has(timeKey)) {
      requestMap.set(timeKey, []);
    }
    requestMap.get(timeKey)!.push({
      id: req.id,
      memberName: req.members?.full_name || 'Unknown',
      type: req.request_type,
      status: req.status
    });
  }

  for (const slot of sessionSlots as any[]) {
    const key = `${slot.block}|${slot.start_time}`;
    slotMap.set(key, slot);
  }

  /*
   * 4. Generate the expected timeline from operating schedules.
   */
  const result: AdminScheduleSlot[] = [];

  for (const schedule of operatingSchedules as any[]) {
    const startMinutes = timeToMinutes(schedule.start_time);
    const endMinutes = timeToMinutes(schedule.end_time);

    for (
      let currentMinutes = startMinutes;
      currentMinutes < endMinutes;
      currentMinutes += schedule.slot_interval_minutes
    ) {
      const startTime = minutesToTime(currentMinutes);

      /*
       * Session duration determines the actual session end.
       *
       * Example:
       * 16:00 + 45 minutes = 16:45
       */
      const sessionEndMinutes =
        currentMinutes + schedule.session_duration_minutes;

      const endTime = minutesToTime(
        Math.min(sessionEndMinutes, endMinutes)
      );

      const slotKey = `${schedule.block}|${startTime}`;
      const existingSlot = slotMap.get(slotKey);
      
      const timeKey = startTime.slice(0, 5);
      const pendingRequests = requestMap.get(timeKey) ?? [];

      /*
       * No session_slots row yet.
       */
      if (!existingSlot) {
        result.push({
          id: null,
          date,
          startTime: timeKey,
          endTime: endTime.slice(0, 5),
          block: schedule.block,
          capacity: schedule.default_capacity,
          isOpen: true,
          closedReason: null,
          slotExists: false,
          booking: null,
          pendingRequests,
        });

        continue;
      }

      /*
       * Existing session_slots row.
       */
      const bookings = existingSlot.bookings ?? [];

      const participants = bookings.flatMap((booking: any) =>
        (booking.booking_participants ?? []).map(
          (participant: any) => ({
            id: participant.id,
            type: participant.participant_type,
            name:
              participant.participant_type === 'MEMBER'
                ? participant.members?.full_name ?? 'Unknown rider'
                : participant.casual_customers?.full_name ??
                'Casual rider',
            avatarUrl:
              participant.participant_type === 'MEMBER'
                ? participant.members?.users?.avatar_url ?? null
                : null,
            memberId: participant.member_id ?? null,
            membershipId: participant.membership_id ?? null,
            casualCustomerId:
              participant.casual_customer_id ?? null,
          })
        )
      );

      const bookingWithParticipants = bookings.find(
        (booking: any) =>
          (booking.booking_participants ?? []).length > 0
      );

      result.push({
        id: existingSlot.id,
        date: existingSlot.slot_date,
        startTime: existingSlot.start_time.slice(0, 5),
        endTime: existingSlot.end_time.slice(0, 5),
        block: existingSlot.block,
        capacity: existingSlot.capacity,
        isOpen: existingSlot.is_open,
        closedReason: existingSlot.closed_reason ?? null,
        slotExists: true,
        booking: bookingWithParticipants
          ? {
            id: bookingWithParticipants.id,
            status: bookingWithParticipants.status,
            notes: bookingWithParticipants.notes ?? null,
            participants,
          }
          : null,
        pendingRequests,
      });
    }
  }

  return result;
}

export async function getAdminSessionDetail(
  slotId: string
): Promise<AdminSessionDetail> {
  const db = await createServerClient();

  const { data, error } = await db
    .from('session_slots')
    .select(`
      id,
      slot_date,
      start_time,
      end_time,
      block,
      capacity,
      is_open,
      closed_reason,
      bookings!bookings_slot_id_fkey (
        id,
        status,
        notes,
        created_at,
        created_by,
        is_casual,
        cancellation_reason,
        cancelled_at,
        booking_participants (
          id,
          participant_type,
          member_id,
          membership_id,
          casual_customer_id,
          price_idr,
          horse_id,
          participant_status,
          requested_slot_id,
          cancellation_reason,
          cancelled_at,
          attendance_status,
          checked_in_at,
          checked_in_by,
          check_in_method,
          members (
            full_name,
            user_id,
            users (
              avatar_url
            )
          ),
          casual_customers (
            full_name
          ),
          horses (
            id,
            name,
            status
          )
        )
      )
    `)
    .eq('id', slotId)
    .single();

  if (error) {
    console.error('[getAdminSessionDetail]', error);
    throw new Error('FAILED_TO_LOAD_ADMIN_SESSION_DETAIL');
  }

  if (!data) {
    throw new Error('ADMIN_SESSION_NOT_FOUND');
  }

  const slot = data as any;

  const bookings: AdminSessionDetailBooking[] = (
    slot.bookings ?? []
  ).map((booking: any) => ({
    id: booking.id,
    status: booking.status,
    notes: booking.notes ?? null,
    createdAt: booking.created_at,
    createdBy: booking.created_by ?? null,
    isCasual: booking.is_casual,
    cancellationReason:
      booking.cancellation_reason ?? null,
    cancelledAt: booking.cancelled_at ?? null,

    participants: (
      booking.booking_participants ?? []
    ).map((participant: any) => ({
      id: participant.id,
      type: participant.participant_type,

      name:
        participant.participant_type === 'MEMBER'
          ? participant.members?.full_name ?? 'Unknown rider'
          : participant.casual_customers?.full_name ?? 'Casual rider',

      avatarUrl:
        participant.participant_type === 'MEMBER'
          ? participant.members?.users?.avatar_url ?? null
          : null,

      memberId: participant.member_id ?? null,
      membershipId: participant.membership_id ?? null,
      casualCustomerId: participant.casual_customer_id ?? null,

      participantStatus: participant.participant_status,
      requestedSlotId: participant.requested_slot_id ?? null,
      cancellationReason: participant.cancellation_reason ?? null,
      cancelledAt: participant.cancelled_at ?? null,

      attendanceStatus: participant.attendance_status,
      checkedInAt: participant.checked_in_at ?? null,
      checkedInBy: participant.checked_in_by ?? null,
      checkInMethod: participant.check_in_method ?? null,

      priceIdr: participant.price_idr ?? null,

      horseId: participant.horses?.id ?? null,
      horseName: participant.horses?.name ?? null,
    }))
  }));

  // Fetch pending riding requests for this slot
  const { data: reqData } = await db
    .from('riding_requests')
    .select('id, request_type, status, member_id, members(full_name, phone)')
    .eq('preferred_date', slot.slot_date)
    .eq('preferred_time_start', slot.start_time)
    .eq('status', 'UNDER_REVIEW');

  const pendingRequests = (reqData ?? []).map(r => {
    const mem = Array.isArray(r.members) ? r.members[0] : r.members;
    return {
      id: r.id,
      memberId: r.member_id,
      memberName: mem?.full_name || 'Unknown',
      memberPhone: mem?.phone || '',
      type: r.request_type,
      status: r.status
    };
  });

  return {
    id: slot.id,
    date: slot.slot_date,
    startTime: slot.start_time.slice(0, 5),
    endTime: slot.end_time.slice(0, 5),
    block: slot.block,

    capacity: slot.capacity,
    isOpen: slot.is_open,
    closedReason: slot.closed_reason ?? null,

    bookings,
    pendingRequests,
  };
}
export async function ensureSlotsForDateRange(startDate: string, endDate: string) {
  const db = await createServerClient();
  
  // Get all operating schedules
  const { data: schedules } = await db.from('operating_schedules').select('*').eq('is_active', true);
  if (!schedules || schedules.length === 0) return;

  // Get existing slots in range
  const { data: existing } = await db
    .from('session_slots')
    .select('slot_date, start_time')
    .gte('slot_date', startDate)
    .lte('slot_date', endDate);
    
  const existingSet = new Set((existing || []).map(s => `${s.slot_date}|${s.start_time}`));
  const toInsert = [];

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);
    
    for (const s of daySchedules) {
      const [startH, startM] = s.start_time.split(':').map(Number);
      const [endH, endM] = s.end_time.split(':').map(Number);
      
      let currentMs = (startH * 60 + startM) * 60000;
      const endMs = (endH * 60 + endM) * 60000;
      const intervalMs = s.slot_interval_minutes * 60000;
      const durationMs = s.session_duration_minutes * 60000;

      while (currentMs + durationMs <= endMs) {
        const slotStartH = Math.floor(currentMs / 3600000).toString().padStart(2, '0');
        const slotStartM = Math.floor((currentMs % 3600000) / 60000).toString().padStart(2, '0');
        const slotStartTime = `${slotStartH}:${slotStartM}:00`;

        const slotEndH = Math.floor((currentMs + durationMs) / 3600000).toString().padStart(2, '0');
        const slotEndM = Math.floor(((currentMs + durationMs) % 3600000) / 60000).toString().padStart(2, '0');
        const slotEndTime = `${slotEndH}:${slotEndM}:00`;

        if (!existingSet.has(`${dateStr}|${slotStartTime}`)) {
          toInsert.push({
            slot_date: dateStr,
            start_time: slotStartTime,
            end_time: slotEndTime,
            capacity: s.default_capacity,
            is_open: true,
            block: s.block
          });
        }
        currentMs += intervalMs;
      }
    }
  }

  if (toInsert.length > 0) {
    await db.from('session_slots').upsert(toInsert, { onConflict: 'slot_date, start_time' });
  }
}

export async function getPendingRequests() {
  const db = await createServerClient();
  const [riding, membership] = await Promise.all([
    db.from('riding_requests').select('id, request_type, status, created_at, member_id, height_cm, weight_kg, shoe_size, members(full_name, phone, users(email, avatar_url))').eq('status', 'UNDER_REVIEW').order('created_at', { ascending: false }),
    db.from('membership_applications').select('id, status, created_at, plan_id, member_id, members(full_name, phone, users(email, avatar_url)), membership_plans(name)').eq('status', 'PENDING').order('created_at', { ascending: false })
  ]);

  const ridingMapped = (riding.data || []).map(r => {
    const mem = Array.isArray(r.members) ? r.members[0] : r.members;
    return {
      id: r.id,
      category: 'riding',
      type: r.request_type,
      status: r.status,
      createdAt: r.created_at,
      memberId: r.member_id,
      memberName: mem?.full_name || 'Unknown',
      memberPhone: mem?.phone || '',
      memberEmail: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.email || '',
      memberAvatarUrl: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.avatar_url || '',
      planName: null,
      heightCm: r.height_cm,
      weightKg: r.weight_kg,
      shoeSize: r.shoe_size
    };
  });

  const membershipMapped = (membership.data || []).map(r => {
    const mem = Array.isArray(r.members) ? r.members[0] : r.members;
    const plan = Array.isArray(r.membership_plans) ? r.membership_plans[0] : r.membership_plans;
    return {
      id: r.id,
      category: 'membership',
      type: 'MEMBERSHIP_APPLICATION',
      status: r.status,
      createdAt: r.created_at,
      memberId: r.member_id,
      memberName: mem?.full_name || 'Unknown',
      memberPhone: mem?.phone || '',
      memberEmail: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.email || '',
      memberAvatarUrl: ((Array.isArray(mem?.users) ? mem?.users[0] : mem?.users) as any)?.avatar_url || '',
      planName: plan?.name || 'Unknown Plan'
    };
  });

  const allRequests = [...ridingMapped, ...membershipMapped].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return allRequests;
}
