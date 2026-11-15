'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { approveRidingRequestWithDb } from '@/modules/bookings/guest-ride-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';

import { DomainError } from '@/domain/shared/errors';

export async function resolveAttendanceAction(
  participantId: string, 
  status: 'ATTENDED' | 'NO_SHOW', 
  creditAction: 'CONSUMED' | 'RETURNED',
  reason?: string
) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);
    await service.resolveAttendance(actor, { participantId, status, creditAction, reason });
    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function assignHorseAction(participantId: string, horseId: string | null) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const { error } = await db.rpc('assign_horse', {
      p_participant_id: participantId,
      p_horse_id: horseId,
      p_actor_id: actor.userId
    });
    if (error) {
      console.error(error);
      return { ok: false, message: error.message };
    }
    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

import { sendDirectPushNotification } from '@/lib/notifications/direct-fcm';

export async function approveBookingAction(bookingId: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by, session_slots(slot_date, start_time)')
      .eq('id', bookingId)
      .single();

    await service.approveBooking(actor, bookingId);

    if (bData?.created_by) {
      const slot = Array.isArray(bData.session_slots) ? bData.session_slots[0] : bData.session_slots;
      sendDirectPushNotification({
        userIds: [bData.created_by],
        title: 'Booking Sesi Disetujui! 🏇',
        body: `Sesi berkuda kamu pada ${slot?.slot_date || ''} jam ${slot?.start_time?.slice(0, 5) || ''} telah dikonfirmasi oleh Admin.`,
        url: '/bookings',
        notificationType: 'BOOKING_CONFIRMED',
        data: { booking_id: bookingId }
      }).catch(err => console.error('[approveBookingAction] Push error:', err));
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}


export async function approveRidingRequestAction(
  requestId: string,
  date: string,
  time: string,
  capacity: number,
  priceIdr?: number | null
) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();

    const result = await approveRidingRequestWithDb(db, {
      requestId,
      date,
      time,
      capacity,
      actorId: actor.userId,
      priceIdr: priceIdr ?? null,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, code: result.code };
    }

    revalidateBookingPaths();
    return { ok: true, bookingId: result.bookingId };
  } catch (err: any) {
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function rejectRidingRequestAction(requestId: string) {
  try {
    await requireActor(['ADMIN'], true);
    const db = await createServerClient();

    const { data: request } = await db
      .from('riding_requests')
      .select('member_id, members(user_id)')
      .eq('id', requestId)
      .single();

    const { error } = await db
      .from('riding_requests')
      .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) {
      console.error(error);
      return { ok: false, message: error.message };
    }

    const memberObj = Array.isArray((request as any)?.members)
      ? (request as any).members[0]
      : (request as any)?.members;
    const recipientUserId = memberObj?.user_id || null;

    if (recipientUserId) {
      await db.from('notification_outbox').insert({
        event_type: 'BOOKING_REJECTED',
        aggregate_type: 'request',
        aggregate_id: requestId,
        recipient_user_id: recipientUserId,
        channel: 'FCM',
        payload: {
          request_id: requestId,
        },
      });
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function rejectBookingAction(bookingId: string, reason: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by')
      .eq('id', bookingId)
      .single();

    await service.rejectBooking(actor, { bookingId, reason });

    if (bData?.created_by) {
      sendDirectPushNotification({
        userIds: [bData.created_by],
        title: 'Pemberitahuan Booking BBS',
        body: `Mohon maaf, permohonan sesi kamu belum dapat disetujui: ${reason}`,
        url: '/bookings',
        notificationType: 'BOOKING_REJECTED',
        data: { booking_id: bookingId }
      }).catch(err => console.error('[rejectBookingAction] Push error:', err));
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}


export async function toggleSlotAction(
  date: string,
  startTime: string,
  endTime: string,
  capacity: number,
  isOpen: boolean,
  closedReason: string | null = null,
) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    
    // Determine block based on start time
    const startHour = parseInt(startTime.split(':')[0], 10);
    const block = startHour < 12 ? 'MORNING' : 'AFTERNOON';

    const { data, error } = await db.from('session_slots').upsert({
      slot_date: date,
      start_time: startTime,
      end_time: endTime,
      block,
      capacity,
      is_open: isOpen,
      closed_reason: isOpen ? null : closedReason,
    }, { onConflict: 'slot_date,start_time' }).select().single();

    if (error) {
      console.error(error);
      return { ok: false, message: error.message };
    }

    revalidateBookingPaths();
    return { ok: true, data };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function multiToggleSlotAction(
  slots: {
    date: string;
    startTime: string;
    endTime: string;
    capacity: number;
    closedReason?: string | null;
  }[],
  isOpen: boolean,
) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    
    const rows = slots.map(s => {
      const startHour = parseInt(s.startTime.split(':')[0], 10);
      const block = startHour < 12 ? 'MORNING' : 'AFTERNOON';
      return {
        slot_date: s.date,
        start_time: s.startTime,
        end_time: s.endTime,
        block,
        capacity: s.capacity,
        is_open: isOpen,
        closed_reason: isOpen ? null : (s.closedReason ?? 'Ditutup oleh Admin'),
      };
    });

    const { error } = await db.from('session_slots').upsert(rows, { onConflict: 'slot_date,start_time' });

    if (error) {
      console.error(error);
      return { ok: false, message: error.message };
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function getScheduleRecapAction(from: string, to: string) {
  try {
    await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const { data, error } = await db
      .from('session_slots')
      .select(`
        slot_date,
        start_time,
        end_time,
        capacity,
        is_open,
        closed_reason,
        bookings!bookings_slot_id_fkey (
          booking_participants ( id )
        )
      `)
      .gte('slot_date', from)
      .lte('slot_date', to)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) return { ok: false, message: error.message };

    return {
      ok: true,
      rows: (data ?? []).map((slot: any) => ({
        date: slot.slot_date,
        startTime: slot.start_time?.slice(0, 5),
        endTime: slot.end_time?.slice(0, 5),
        capacity: slot.capacity,
        isOpen: slot.is_open,
        closedReason: slot.closed_reason ?? '',
        riderCount: (slot.bookings ?? []).flatMap((booking: any) => booking.booking_participants ?? []).length,
      })),
    };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'Rekap jadwal tidak dapat dibuat.' };
  }
}

export async function cancelBookingAction(bookingId: string, reason?: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by, session_slots(slot_date, start_time)')
      .eq('id', bookingId)
      .single();

    await service.cancelBooking(actor, {
      bookingId,
      reason: reason || 'Dibatalkan oleh admin via WhatsApp / konfirmasi langsung',
      acknowledgeLateForfeit: false
    });

    if (bData?.created_by) {
      const slot = Array.isArray(bData.session_slots) ? bData.session_slots[0] : bData.session_slots;
      sendDirectPushNotification({
        userIds: [bData.created_by],
        title: 'Sesi Dibatalkan oleh Admin',
        body: `Sesi berkuda kamu pada ${slot?.slot_date || ''} jam ${slot?.start_time?.slice(0, 5) || ''} telah dibatalkan oleh Admin.`,
        url: '/bookings',
        notificationType: 'BOOKING_BBS_CANCELLED',
        data: { booking_id: bookingId }
      }).catch(err => console.error('[cancelBookingAction] Push error:', err));
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: err?.message || 'Gagal membatalkan booking.' };
  }
}


