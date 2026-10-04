'use server';

import { revalidatePath } from 'next/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { DomainError } from '@/domain/shared/errors';

export async function assignHorseAction(participantId: string, formData: FormData) {
  try {
    const actor = await requireActor(['GROOMER'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);
    
    let horseId: string | null = formData.get('horseId') as string;
    if (!horseId || horseId === 'UNASSIGN') {
      horseId = null;
    }

    await service.assignHorse(actor, { participantId, horseId });
    revalidatePath('/groomer');
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}

export async function resolveAttendanceAction(participantId: string, status: 'ATTENDED' | 'NO_SHOW') {
  try {
    const actor = await requireActor(['GROOMER'], true);
    const db = await createServerClient();
    const service = new BookingService(db as never);
    await service.resolveAttendance(actor, { participantId, status, creditAction: 'CONSUMED', reason: 'OTHER' });
    revalidatePath('/groomer');
    return { ok: true };
  } catch (err: any) {
    if (err instanceof DomainError) return { ok: false, message: err.message };
    console.error(err);
    return { ok: false, message: 'An unexpected error occurred.' };
  }
}
