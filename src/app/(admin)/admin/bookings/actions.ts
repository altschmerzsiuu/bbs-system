'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';

import { DomainError } from '@/domain/shared/errors';

export async function approveBookingAction(bookingId: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);
    await service.approveBooking(actor, bookingId);
    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function rejectBookingAction(bookingId: string) {
  try {
    const actor = await requireActor(['ADMIN'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);
    await service.rejectBooking(actor, { bookingId, reason: 'Rejected by admin' });
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
    await service.approveReschedule(actor, bookingId);
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
    await service.rejectReschedule(actor, { bookingId, reason: 'Reschedule rejected by admin' });
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
    await service.cancelBooking(actor, { bookingId, reason: 'Cancelled by admin operations', acknowledgeLateForfeit: false });
    revalidateBookingPaths();
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}
