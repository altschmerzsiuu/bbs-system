'use server';

import { revalidateBookingPaths } from '@/lib/cache';
import { BookingService } from '@/modules/bookings/booking-service';
import { createServerClient, createServiceRoleClient } from '@/infrastructure/supabase-server';
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
  participantsOrOptions?: string | { hasPhotographer?: boolean; receiptUrl?: string; participants?: string }, 
  withPhotographer?: boolean
): Promise<ActionResult> {
  const actor = await requireActor(['MEMBER'], true);
  const db = await createServerClient();
  const service = new BookingService(db as never);
  try {
    let parsedParticipants: ({ type: 'MEMBER'; memberId: string } | { type: 'CASUAL'; fullName: string; phone: string })[] = [{ type: 'MEMBER', memberId: actor.memberId! }];
    let hasPhoto = Boolean(withPhotographer);
    let receiptUrl: string | undefined;

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
      if (participantsOrOptions.receiptUrl) {
        receiptUrl = participantsOrOptions.receiptUrl;
      }
      if (participantsOrOptions.participants) {
        try {
          parsedParticipants = JSON.parse(participantsOrOptions.participants);
        } catch {
          // default to current actor
        }
      }
    }

    const notes = hasPhoto 
      ? `📸 Include Fotografer (+Rp 200.000)${receiptUrl ? ` [Bukti: ${receiptUrl}]` : ''}` 
      : undefined;

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

export async function uploadPhotographerReceiptAction(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const actor = await requireActor(['MEMBER'], true);
    const file = formData.get('receipt') as File;
    if (!file) {
      return { ok: false, message: 'File bukti transfer tidak ditemukan.' };
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { ok: false, message: 'Ukuran file maksimal 5MB.' };
    }

    const db = createServiceRoleClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `photographer-${actor.userId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await db.storage
      .from('payment_proofs')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('[uploadPhotographerReceiptAction]', uploadError);
      return { ok: false, message: uploadError.message };
    }

    const { data: { publicUrl } } = db.storage.from('payment_proofs').getPublicUrl(fileName);
    return { ok: true, url: publicUrl };
  } catch (error) {
    const clientErr = toClientError(error);
    return { ok: false, message: clientErr.message };
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
