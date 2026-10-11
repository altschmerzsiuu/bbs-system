'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { sendDirectPushNotification } from '@/lib/notifications/direct-fcm';
import { DomainError } from '@/domain/shared/errors';

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

export async function rejectBookingAction(bookingId: string, reason = 'Ditolak oleh admin') {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by, session_slots(slot_date, start_time)')
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

export async function approveRescheduleAction(bookingId: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by, requested_slot:session_slots!bookings_requested_slot_id_fkey(slot_date, start_time)')
      .eq('id', bookingId)
      .single();

    await service.approveReschedule(actor, bookingId);

    if (bData?.created_by) {
      const slot = Array.isArray(bData.requested_slot) ? bData.requested_slot[0] : bData.requested_slot;
      sendDirectPushNotification({
        userIds: [bData.created_by],
        title: 'Reschedule Sesi Disetujui! 🏇',
        body: `Permintaan jadwal baru kamu (${slot?.slot_date || ''} jam ${slot?.start_time?.slice(0, 5) || ''}) telah disetujui.`,
        url: '/bookings',
        notificationType: 'RESCHEDULE_APPROVED',
        data: { booking_id: bookingId }
      }).catch(err => console.error('[approveRescheduleAction] Push error:', err));
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function rejectRescheduleAction(bookingId: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by')
      .eq('id', bookingId)
      .single();

    await service.rejectReschedule(actor, { bookingId, reason: 'Reschedule rejected by admin' });

    if (bData?.created_by) {
      sendDirectPushNotification({
        userIds: [bData.created_by],
        title: 'Permintaan Reschedule Ditolak',
        body: 'Permintaan pindah jadwal tidak dapat disetujui. Jadwal semula tetap berlaku.',
        url: '/bookings',
        notificationType: 'RESCHEDULE_REJECTED',
        data: { booking_id: bookingId }
      }).catch(err => console.error('[rejectRescheduleAction] Push error:', err));
    }

    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function cancelBookingAction(bookingId: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);

    const { data: bData } = await db
      .from('bookings')
      .select('created_by, session_slots(slot_date, start_time)')
      .eq('id', bookingId)
      .single();

    await service.cancelBooking(actor, { bookingId, reason: 'Cancelled by admin operations', acknowledgeLateForfeit: false });

    if (bData?.created_by) {
      const slot = Array.isArray(bData.session_slots) ? bData.session_slots[0] : bData.session_slots;
      sendDirectPushNotification({
        userIds: [bData.created_by],
        title: 'Sesi Dibatalkan oleh Admin',
        body: `Sesi berkuda pada ${slot?.slot_date || ''} jam ${slot?.start_time?.slice(0, 5) || ''} telah dibatalkan oleh Admin.`,
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
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

