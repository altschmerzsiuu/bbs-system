'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient } from '@/infrastructure/supabase-server';
import { requireActor } from '@/lib/auth';
import { toClientError } from '@/domain/shared/errors';

export type ActionResult = { ok: true; bookingId: string } | { ok: false; code: string; message: string };

/**
 * Server Action = satu-satunya jalan menulis booking dari UI.
 * Tidak ada aturan bisnis di komponen: eligibility, window, kapasitas dan
 * kredit semuanya divalidasi di dalam transaksi database (Section 64.22).
 */
export async function submitBooking(slotId: string, participants?: string): Promise<ActionResult> {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();
  const service = new BookingService(db as never);
  try {
    const parsedParticipants = typeof participants === 'string' 
      ? JSON.parse(participants) 
      : [{ type: 'MEMBER', memberId: actor.memberId! }];

    const bookingId = await service.createMemberBooking(actor, { 
      slotId, 
      participants: parsedParticipants 
    });
    revalidateBookingPaths();
    return { ok: true, bookingId };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}

export type LookupResult = { ok: true; memberId: string; fullName: string } | { ok: false; message: string };

export async function lookupMemberByEmail(email: string): Promise<LookupResult> {
  const actor = await requireActor(['MEMBER']);
  const db = await createServerClient();

  const { data: member } = await db
    .from('members')
    .select('id, full_name, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (!member) {
    return { ok: false, message: 'Member tidak ditemukan. Pastikan email sudah benar.' };
  }
  
  if (member.id === actor.memberId) {
    return { ok: false, message: 'Anda tidak perlu menambahkan email sendiri.' };
  }

  // Validate if they have active membership
  const { data: membership } = await db
    .from('memberships')
    .select('id')
    .eq('member_id', member.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!membership) {
    return { ok: false, message: 'Member ini tidak memiliki membership yang aktif.' };
  }

  return { ok: true, memberId: member.id, fullName: member.full_name };
}
