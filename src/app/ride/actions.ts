'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';
import {
  normalizePhoneToE164,
  submitGuestRideWithDb,
  type SubmitGuestResult,
} from '@/modules/bookings/guest-ride-service';

export async function submitGuestRequest(formData: FormData): Promise<SubmitGuestResult> {
  try {
    const hdrs = await headers();
    const forwardedFor = hdrs.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : hdrs.get('x-real-ip') || 'unknown';

    const adminDb = createServiceRoleClient();
    const result = await submitGuestRideWithDb(adminDb, formData, { clientIp });

    if (result.ok) {
      revalidatePath('/admin/applications');
      revalidatePath('/admin');
      revalidatePath('/admin/schedule');
    }

    return result;
  } catch (err: any) {
    console.error('[submitGuestRequest] Unexpected error:', err);
    return {
      ok: false,
      error: 'Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.',
      code: 'INTERNAL_ERROR',
    };
  }
}

export async function lookupGuestTicketAction(formData: FormData): Promise<
  | { ok: true; publicToken: string; humanId: string }
  | { ok: false; error: string }
> {
  try {
    const rawPhone = String(formData.get('phone') || '').trim();
    const rawQuery = String(formData.get('requestCode') || '').trim().toUpperCase();

    const normalizedPhone = normalizePhoneToE164(rawPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return { ok: false, error: 'Masukkan nomor WhatsApp yang digunakan saat memesan.' };
    }

    const adminDb = createServiceRoleClient();
    const localPhone = normalizedPhone.startsWith('+62')
      ? `0${normalizedPhone.slice(3)}`
      : normalizedPhone;

    const { data: customers } = await adminDb
      .from('casual_customers')
      .select('id, phone')
      .in('phone', [normalizedPhone, localPhone, rawPhone]);

    if (!customers || customers.length === 0) {
      return {
        ok: false,
        error: 'Data pesanan tidak ditemukan untuk nomor WhatsApp tersebut.',
      };
    }

    const customerIds = customers.map((c: { id: string }) => c.id);

    let query = adminDb
      .from('riding_requests')
      .select('id, human_id, public_token, created_at')
      .in('casual_customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (rawQuery) {
      query = query.ilike('human_id', `%${rawQuery}%`);
    }

    const { data: reqRow, error: reqErr } = await query.maybeSingle();

    if (reqErr) {
      // Fallback if public_token column is not yet migrated on remote DB
      const { data: fallbackRow } = await adminDb
        .from('riding_requests')
        .select('id, human_id, created_at')
        .in('casual_customer_id', customerIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!fallbackRow) {
        return { ok: false, error: 'Belum ada riwayat pesanan Fun Ride / Casual untuk nomor ini.' };
      }
      return {
        ok: true,
        publicToken: fallbackRow.id,
        humanId: fallbackRow.human_id,
      };
    }

    if (!reqRow) {
      return {
        ok: false,
        error: 'Belum ada riwayat pesanan Fun Ride / Casual yang cocok.',
      };
    }

    return {
      ok: true,
      publicToken: reqRow.public_token || reqRow.id,
      humanId: reqRow.human_id,
    };
  } catch (err) {
    console.error('[lookupGuestTicketAction] Unexpected error:', err);
    return { ok: false, error: 'Gagal mencari tiket. Silakan coba lagi.' };
  }
}
