'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';
import {
  normalizePhoneToE164,
  submitGuestRideWithDb,
  type SubmitGuestResult,
} from '@/modules/bookings/guest-ride-service';

// In-memory rate limiter for ticket lookup to prevent brute-forcing 4-digit REQ-XXXX codes
const lookupAttempts = new Map<string, { count: number; resetAt: number }>();
const LOOKUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_LOOKUP_ATTEMPTS = 5;

function checkLookupRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = lookupAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    lookupAttempts.set(key, { count: 1, resetAt: now + LOOKUP_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_LOOKUP_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

function clearLookupRateLimit(key: string): void {
  lookupAttempts.delete(key);
}

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
    const hdrs = await headers();
    const forwardedFor = hdrs.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : hdrs.get('x-real-ip') || 'unknown';

    const rawPhone = String(formData.get('phone') || '').trim();
    const rawCodeInput = String(formData.get('code') || formData.get('requestCode') || '')
      .trim()
      .toUpperCase();

    const normalizedPhone = normalizePhoneToE164(rawPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return { ok: false, error: 'Masukkan nomor WhatsApp yang valid saat memesan.' };
    }

    // Security (Anti-IDOR): Require BOTH WhatsApp number AND exact Ticket Code (REQ-XXXX)
    const codeDigits = rawCodeInput.replace(/\D/g, '');
    if (!rawCodeInput || codeDigits.length < 4) {
      return {
        ok: false,
        error: 'Demi keamanan privasi, wajib memasukkan Kode Tiket 4 angka (contoh: REQ-4821 atau 4821) bersama Nomor WhatsApp Anda.',
      };
    }

    const normalizedCode = rawCodeInput.startsWith('REQ-')
      ? rawCodeInput
      : `REQ-${codeDigits.slice(0, 4)}`;

    const rateKey = `${clientIp}:${normalizedPhone}`;
    if (!checkLookupRateLimit(rateKey)) {
      return {
        ok: false,
        error: 'Terlalu banyak percobaan pencarian tiket. Silakan tunggu 10 menit sebelum mencoba kembali.',
      };
    }

    const adminDb = createServiceRoleClient();
    const localPhone = normalizedPhone.startsWith('+62')
      ? `0${normalizedPhone.slice(3)}`
      : normalizedPhone;

    const { data: customers } = await adminDb
      .from('casual_customers')
      .select('id, phone')
      .in('phone', [normalizedPhone, localPhone, rawPhone]);

    const genericNotFoundError =
      'Kombinasi Nomor WhatsApp dan Kode Tiket (REQ-XXXX) tidak cocok atau tidak ditemukan.';

    if (!customers || customers.length === 0) {
      return {
        ok: false,
        error: genericNotFoundError,
      };
    }

    const customerIds = customers.map((c: { id: string }) => c.id);

    const { data: reqRow, error: reqErr } = await adminDb
      .from('riding_requests')
      .select('id, human_id, public_token, created_at')
      .in('casual_customer_id', customerIds)
      .eq('human_id', normalizedCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reqErr) {
      // Fallback if public_token column is not yet migrated on remote DB
      const { data: fallbackRow } = await adminDb
        .from('riding_requests')
        .select('id, human_id, created_at')
        .in('casual_customer_id', customerIds)
        .eq('human_id', normalizedCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!fallbackRow) {
        return { ok: false, error: genericNotFoundError };
      }

      clearLookupRateLimit(rateKey);
      return {
        ok: true,
        publicToken: fallbackRow.id,
        humanId: fallbackRow.human_id,
      };
    }

    if (!reqRow) {
      return {
        ok: false,
        error: genericNotFoundError,
      };
    }

    clearLookupRateLimit(rateKey);
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
