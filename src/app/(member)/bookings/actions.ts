'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';

export type ActionResult = { ok: true; data?: any } | { ok: false; code: string; message: string };

export async function cancelBookingAction(bookingId: string, acknowledgeLateForfeit: boolean): Promise<ActionResult> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new BookingService(db as never);
  try {
    const res = await service.cancelBooking(actor, { bookingId, acknowledgeLateForfeit, reason: 'Dibatalkan oleh member' });
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
    revalidateBookingPaths();
    return { ok: true };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}
