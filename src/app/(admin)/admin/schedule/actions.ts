'use server';

import { revalidatePath } from 'next/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';

import { DomainError } from '@/domain/shared/errors';

export async function resolveAttendanceAction(participantId: string, status: 'ATTENDED' | 'NO_SHOW', creditAction: 'CONSUMED' | 'RETURNED') {
  try {
    const actor = await requireActor(['ADMIN']);
    const db = await createServerClient();
    const service = new BookingService(db as never);
    await service.resolveAttendance(actor, { participantId, status, creditAction, reason: 'OTHER' });
    revalidatePath('/admin/schedule');
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}
