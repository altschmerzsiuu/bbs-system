'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';
import { sendDirectPushNotification } from '@/lib/notifications/direct-fcm';

export type ActionResult = { ok: true; data?: any } | { ok: false; code: string; message: string };

export async function cancelBookingAction(bookingId: string, acknowledgeLateForfeit: boolean): Promise<ActionResult> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new BookingService(db as never);
  try {
    const res = await service.cancelBooking(actor, { bookingId, acknowledgeLateForfeit, reason: 'Dibatalkan oleh member' });

    sendDirectPushNotification({
      toAdmins: true,
      title: 'Pembatalan Sesi oleh Member ⚠️',
      body: `Seorang member telah membatalkan booking sesi berkuda mereka (${res === 'LATE' ? 'Late cancel - kuota hangus' : 'Early cancel'}).`,
      url: '/admin',
      notificationType: 'BOOKING_MEMBER_CANCELLED',
      data: { booking_id: bookingId }
    }).catch(err => console.error('[cancelBookingAction] Push error:', err));

    revalidateBookingPaths();
    return { ok: true, data: res };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}

export async function requestRescheduleAction(bookingId: string, newSlotId: string): Promise<ActionResult> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new BookingService(db as never);
  try {
    await service.requestReschedule(actor, { bookingId, newSlotId });

    sendDirectPushNotification({
      toAdmins: true,
      title: 'Permintaan Reschedule Baru 📅',
      body: 'Member mengajukan permintaan pindah jadwal sesi berkuda.',
      url: '/admin',
      notificationType: 'RESCHEDULE_REQUESTED',
      data: { booking_id: bookingId }
    }).catch(err => console.error('[requestRescheduleAction] Push error:', err));

    revalidateBookingPaths();
    return { ok: true };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}

