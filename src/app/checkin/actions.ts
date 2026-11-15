'use server';

import { revalidatePath } from 'next/cache';
import { requireActor } from '@/lib/auth';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';
import { revalidateBookingPaths } from '@/lib/cache';

function extractTokenFromScan(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';

  // If scanned value is a full URL like https://.../checkin/<token> or https://.../ride/status/<token>
  const urlMatch = trimmed.match(/\/(?:checkin|ride\/status)\/([A-Za-z0-9_-]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  return trimmed;
}

export async function lookupCheckinTokenAction(rawInput: string): Promise<{
  ok: boolean;
  token?: string;
  message?: string;
}> {
  try {
    await requireActor(['ADMIN', 'GROOMER']);
    const extracted = extractTokenFromScan(rawInput);
    if (!extracted) {
      return { ok: false, message: 'Masukkan kode tiket (contoh: REQ-1234) atau scan QR E-Ticket.' };
    }

    const adminDb = createServiceRoleClient();
    const upper = extracted.toUpperCase();
    const normalizedHumanId = /^\d{4}$/.test(upper) ? `REQ-${upper}` : upper;

    // 1. Check by human_id (e.g. REQ-1234)
    if (normalizedHumanId.startsWith('REQ-')) {
      const { data: byHuman } = await adminDb
        .from('riding_requests')
        .select('id, public_token, human_id')
        .eq('human_id', normalizedHumanId)
        .maybeSingle();

      if (byHuman) {
        return { ok: true, token: (byHuman as any).public_token || byHuman.id };
      }
    }

    // 2. Check by public_token
    const { data: byToken } = await adminDb
      .from('riding_requests')
      .select('id, public_token')
      .eq('public_token', extracted)
      .maybeSingle();

    if (byToken) {
      return { ok: true, token: (byToken as any).public_token || byToken.id };
    }

    // 3. Check by UUID (riding_requests.id or bookings.id)
    if (/^[0-9a-fA-F-]{36}$/.test(extracted)) {
      const { data: byReqId } = await adminDb
        .from('riding_requests')
        .select('id, public_token')
        .eq('id', extracted)
        .maybeSingle();

      if (byReqId) {
        return { ok: true, token: (byReqId as any).public_token || byReqId.id };
      }

      const { data: byBookingId } = await adminDb
        .from('bookings')
        .select('id')
        .eq('id', extracted)
        .maybeSingle();

      if (byBookingId) {
        return { ok: true, token: byBookingId.id };
      }
    }

    return {
      ok: false,
      message: 'Tiket tidak ditemukan. Pastikan QR E-Ticket atau kode REQ-XXXX benar.',
    };
  } catch (err: any) {
    console.error('[lookupCheckinTokenAction] Error:', err);
    return { ok: false, message: 'Gagal mencari data tiket.' };
  }
}

export async function confirmQrCheckinAction(input: {
  participantId: string;
  bookingId: string;
  horseId?: string | null;
  token?: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const actor = await requireActor(['ADMIN', 'GROOMER']);
    const adminDb = createServiceRoleClient();
    const nowIso = new Date().toISOString();

    const { data: participant, error: partFetchErr } = await adminDb
      .from('booking_participants')
      .select('id, booking_id, participant_type, member_id, horse_id')
      .eq('id', input.participantId)
      .single();

    if (partFetchErr || !participant) {
      return { ok: false, message: 'Data peserta booking tidak ditemukan.' };
    }

    const updatePayload: Record<string, any> = {
      attendance_status: 'ATTENDED',
      checked_in_at: nowIso,
      checked_in_by: actor.userId,
      check_in_method: 'ADMIN',
    };

    if (input.horseId !== undefined) {
      updatePayload.horse_id = input.horseId || null;
    }

    let { error: updateErr } = await adminDb
      .from('booking_participants')
      .update(updatePayload)
      .eq('id', input.participantId);

    if (updateErr) {
      // Fallback if some check_in columns don't exist on older schema
      const fallbackUpdate = await adminDb
        .from('booking_participants')
        .update({
          attendance_status: 'ATTENDED',
          ...(input.horseId !== undefined ? { horse_id: input.horseId || null } : {}),
        })
        .eq('id', input.participantId);
      updateErr = fallbackUpdate.error;
    }

    if (updateErr) {
      return { ok: false, message: updateErr.message || 'Gagal memperbarui status check-in.' };
    }

    // Upsert attendance_records for reporting & groomer dashboard compatibility
    const creditAction = participant.participant_type === 'CASUAL' ? 'NOT_APPLICABLE' : 'CONSUMED';
    await adminDb.from('attendance_records').upsert(
      {
        booking_id: input.bookingId,
        participant_id: input.participantId,
        status: 'ATTENDED',
        credit_action: creditAction,
        reason: 'Checked in via E-Ticket QR Scanner',
        resolved_by: actor.userId,
        resolved_at: nowIso,
      },
      { onConflict: 'participant_id' }
    );

    revalidateBookingPaths();
    revalidatePath('/groomer');
    revalidatePath('/admin');
    if (input.token) {
      revalidatePath(`/checkin/${input.token}`);
      revalidatePath(`/ride/status/${input.token}`);
    }

    return { ok: true };
  } catch (err: any) {
    console.error('[confirmQrCheckinAction] Error:', err);
    return { ok: false, message: err?.message || 'Terjadi kesalahan saat memproses check-in.' };
  }
}
