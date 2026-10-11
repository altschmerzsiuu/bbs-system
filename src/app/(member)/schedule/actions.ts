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
export async function submitBooking(
  slotId: string, 
  participantsOrOptions?: string | { hasPhotographer?: boolean; participants?: string }, 
  withPhotographer?: boolean
): Promise<ActionResult> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new BookingService(db as never);
  try {
    let parsedParticipants: ({ type: 'MEMBER'; memberId: string } | { type: 'CASUAL'; fullName: string; phone: string })[] = [{ type: 'MEMBER', memberId: actor.memberId! }];
    let hasPhoto = Boolean(withPhotographer);

    if (typeof participantsOrOptions === 'string') {
      try {
        parsedParticipants = JSON.parse(participantsOrOptions);
      } catch {
        // default to current actor
      }
    } else if (participantsOrOptions && typeof participantsOrOptions === 'object') {
      if (typeof participantsOrOptions.hasPhotographer === 'boolean') {
        hasPhoto = participantsOrOptions.hasPhotographer;
      }
      if (participantsOrOptions.participants) {
        try {
          parsedParticipants = JSON.parse(participantsOrOptions.participants);
        } catch {
          // default to current actor
        }
      }
    }

    const notes = hasPhoto ? '📸 Include Fotografer (+Rp 200.000)' : undefined;

    const bookingId = await service.createMemberBooking(actor, { 
      slotId, 
      participants: parsedParticipants,
      notes
    });
    revalidateBookingPaths();
    return { ok: true, bookingId };
  } catch (error) {
    return { ok: false, ...toClientError(error) };
  }
}

export type LookupResult = { ok: true; memberId: string; fullName: string } | { ok: false; message: string };

export async function lookupMemberByEmail(email: string): Promise<LookupResult> {
  const actor = await requireActor(['MEMBER'], true);
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
