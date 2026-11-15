import crypto from 'crypto';
import { z } from 'zod';

export function normalizePhoneToE164(rawPhone: string): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `+62${digits}`;
  }
  return `+${digits}`;
}

export function calculateAge(dateOfBirth: string, referenceDate: Date = new Date()): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const m = referenceDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export const guestRequestSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.'),
    phone: z
      .string()
      .trim()
      .min(8, 'Nomor WhatsApp tidak valid.')
      .transform(normalizePhoneToE164)
      .refine((val) => /^\+628[0-9]{7,13}$/.test(val), 'Masukkan nomor WhatsApp Indonesia yang valid (contoh: 0812...).'),
    dateOfBirth: z
      .string()
      .trim()
      .min(1, 'Tanggal lahir wajib diisi.')
      .refine((val) => !Number.isNaN(new Date(`${val}T00:00:00`).getTime()), 'Tanggal lahir tidak valid.'),
    domicile: z.string().trim().min(2, 'Kota domisili wajib diisi.'),
    heightCm: z.coerce.number().min(50, 'Tinggi badan minimal 50 cm.').max(250, 'Tinggi badan maksimal 250 cm.'),
    weightKg: z.coerce.number().min(15, 'Berat badan minimal 15 kg.').max(200, 'Berat badan maksimal 200 kg.'),
    shoeSize: z.coerce.number().min(20, 'Ukuran sepatu minimal 20.').max(50, 'Ukuran sepatu maksimal 50.'),
    requestType: z.enum(['CASUAL_RIDE', 'JOY_RIDE'], {
      errorMap: () => ({ message: 'Pilih jenis layanan berkuda.' }),
    }),
    preferredDate: z.string().trim().min(1, 'Pilih tanggal sesi berkuda.'),
    preferredTime: z.string().trim().min(1, 'Pilih jam sesi berkuda.'),
    waiverAccepted: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true' || v === 'on' || v === '1')
      .refine((v) => v === true, 'Anda wajib menyetujui ketentuan keselamatan berkuda (waiver).'),
    guardianName: z.string().trim().optional().nullable(),
    guardianPhone: z.string().trim().optional().nullable(),
    website: z.string().optional().nullable(), // Honeypot field
    turnstileToken: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    const age = calculateAge(val.dateOfBirth);
    if (age < 17) {
      if (!val.guardianName || val.guardianName.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianName'],
          message: 'Nama orang tua / wali wajib diisi untuk rider berusia di bawah 17 tahun.',
        });
      }
      const normGuardianPhone = val.guardianPhone ? normalizePhoneToE164(val.guardianPhone) : '';
      if (!/^\+628[0-9]{7,13}$/.test(normGuardianPhone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardianPhone'],
          message: 'Nomor WhatsApp orang tua / wali wajib diisi dengan benar untuk rider di bawah 17 tahun.',
        });
      }
    }
  });

// In-memory sliding window rate limiter (per phone & per IP)
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

export function checkGuestRateLimit(key: string, nowMs: number = Date.now()): boolean {
  if (!key) return true;
  const timestamps = rateLimitStore.get(key) || [];
  const recent = timestamps.filter((t) => nowMs - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitStore.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  rateLimitStore.set(key, recent);
  return true;
}

export function resetGuestRateLimitForTests(): void {
  rateLimitStore.clear();
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Turnstile not configured in environment; rely on honeypot + rate limit
    return true;
  }
  if (!token) {
    return false;
  }
  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}

export function generateRidingRequestHumanId(now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `BBS-REQ-${dd}${mm}${yy}-${suffix}`;
}

export type SubmitGuestResult =
  | {
      ok: true;
      requestId: string;
      recordId: string;
      publicToken: string;
      requestType: 'CASUAL_RIDE' | 'JOY_RIDE';
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function submitGuestRideWithDb(
  adminDb: any,
  input: FormData | Record<string, any>,
  options?: { clientIp?: string; skipTurnstile?: boolean; now?: Date }
): Promise<SubmitGuestResult> {
  const getField = (k: string) => {
    if (typeof FormData !== 'undefined' && input instanceof FormData) {
      return input.get(k);
    }
    return (input as Record<string, any>)[k];
  };

  // 1. Honeypot check
  const honeypot = getField('website');
  if (honeypot && String(honeypot).trim() !== '') {
    return { ok: false, error: 'Permintaan terdeteksi sebagai spam.', code: 'SPAM_DETECTED' };
  }

  // 2. Parse & validate payload
  const rawPayload = {
    fullName: getField('fullName') ?? '',
    phone: getField('phone') ?? '',
    dateOfBirth: getField('dateOfBirth') ?? '',
    domicile: getField('domicile') ?? '',
    heightCm: getField('heightCm'),
    weightKg: getField('weightKg'),
    shoeSize: getField('shoeSize'),
    requestType: getField('requestType') ?? 'CASUAL_RIDE',
    preferredDate: getField('preferredDate') ?? '',
    preferredTime: getField('preferredTime') ?? '',
    waiverAccepted: getField('waiverAccepted') ?? false,
    guardianName: getField('guardianName') ?? null,
    guardianPhone: getField('guardianPhone') ?? null,
    website: getField('website') ?? '',
    turnstileToken: getField('cf-turnstile-response') ?? getField('turnstileToken') ?? null,
  };

  const parsed = guestRequestSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      error: firstIssue?.message || 'Data tidak valid. Periksa kembali isian form Anda.',
      code: 'VALIDATION_ERROR',
    };
  }

  const data = parsed.data;
  const normalizedGuardianPhone = data.guardianPhone ? normalizePhoneToE164(data.guardianPhone) : null;

  // 3. Turnstile verification (when configured)
  if (!options?.skipTurnstile) {
    const turnstileOk = await verifyTurnstileToken(data.turnstileToken, options?.clientIp);
    if (!turnstileOk) {
      return {
        ok: false,
        error: 'Verifikasi keamanan gagal. Silakan muat ulang halaman dan coba lagi.',
        code: 'TURNSTILE_FAILED',
      };
    }
  }

  // 4. Rate limit per IP and per normalized phone
  const nowMs = (options?.now ?? new Date()).getTime();
  if (options?.clientIp && !checkGuestRateLimit(`ip:${options.clientIp}`, nowMs)) {
    return {
      ok: false,
      error: 'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu beberapa menit.',
      code: 'RATE_LIMITED',
    };
  }
  if (!checkGuestRateLimit(`phone:${data.phone}`, nowMs)) {
    return {
      ok: false,
      error: 'Nomor WhatsApp ini baru saja mengirim beberapa permohonan. Silakan tunggu beberapa menit.',
      code: 'RATE_LIMITED',
    };
  }

  // 5. Upsert casual_customers by normalized phone (+62...)
  const notesSummary = [
    `Domisili: ${data.domicile}`,
    `Tgl Lahir: ${data.dateOfBirth}`,
    `TB/BB: ${data.heightCm}cm/${data.weightKg}kg (Sepatu: ${data.shoeSize})`,
    data.guardianName ? `Wali: ${data.guardianName} (${normalizedGuardianPhone || '-'})` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  let casualCustomerId: string | null = null;

  // First check if a casual_customer already exists with this phone
  const { data: existingCasual } = await adminDb
    .from('casual_customers')
    .select('id')
    .eq('phone', data.phone)
    .limit(1)
    .maybeSingle();

  if (existingCasual?.id) {
    casualCustomerId = existingCasual.id;
    // Try updating with extended columns first, fallback to base columns if migration 0053 isn't applied yet
    const { error: updateExtErr } = await adminDb
      .from('casual_customers')
      .update({
        full_name: data.fullName,
        phone: data.phone,
        date_of_birth: data.dateOfBirth,
        domicile: data.domicile,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        shoe_size: data.shoeSize,
        notes: notesSummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', casualCustomerId);

    if (updateExtErr) {
      await adminDb
        .from('casual_customers')
        .update({
          full_name: data.fullName,
          phone: data.phone,
          notes: notesSummary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', casualCustomerId);
    }
  } else {
    // Try upserting/inserting with extended columns first, fallback to base columns
    const { data: insertedExt, error: insertExtErr } = await adminDb
      .from('casual_customers')
      .upsert(
        {
          full_name: data.fullName,
          phone: data.phone,
          date_of_birth: data.dateOfBirth,
          domicile: data.domicile,
          height_cm: data.heightCm,
          weight_kg: data.weightKg,
          shoe_size: data.shoeSize,
          notes: notesSummary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
      .select('id')
      .single();

    if (!insertExtErr && insertedExt?.id) {
      casualCustomerId = insertedExt.id;
    } else {
      const { data: insertedBase, error: insertBaseErr } = await adminDb
        .from('casual_customers')
        .insert({
          full_name: data.fullName,
          phone: data.phone,
          notes: notesSummary,
        })
        .select('id')
        .single();

      if (insertBaseErr || !insertedBase?.id) {
        return {
          ok: false,
          error: 'Gagal menyimpan data tamu. Silakan coba lagi.',
          code: 'CASUAL_UPSERT_FAILED',
        };
      }
      casualCustomerId = insertedBase.id;
    }
  }

  // 6. Insert riding_requests with retry on human_id collision (up to 5 attempts)
  const normalizedTime =
    data.preferredTime.length === 5 ? `${data.preferredTime}:00` : data.preferredTime;
  const publicToken = crypto.randomBytes(16).toString('hex');
  const waiverAcceptedAt = (options?.now ?? new Date()).toISOString();

  let humanId = '';
  let recordId = '';
  let savedToken = publicToken;
  let lastInsertErr: any = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    humanId = generateRidingRequestHumanId(options?.now);

    const { data: reqData, error: reqError } = await adminDb
      .from('riding_requests')
      .insert({
        human_id: humanId,
        casual_customer_id: casualCustomerId,
        member_id: null,
        request_type: data.requestType,
        preferred_date: data.preferredDate,
        preferred_time_start: normalizedTime,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        shoe_size: data.shoeSize,
        status: 'UNDER_REVIEW',
        public_token: publicToken,
        waiver_accepted_at: waiverAcceptedAt,
        guardian_name: data.guardianName || null,
        guardian_phone: normalizedGuardianPhone,
      })
      .select('id, public_token')
      .single();

    if (!reqError && reqData) {
      recordId = reqData.id;
      savedToken = reqData.public_token || publicToken;
      lastInsertErr = null;
      break;
    }

    lastInsertErr = reqError;
    const errMsg = String(reqError?.message || '');
    const errCode = String(reqError?.code || '');

    // If the error is a unique violation on human_id, retry with a new random suffix
    if (errCode === '23505' || errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('unique')) {
      continue;
    }

    // Fallback if migration 0053 columns (public_token, waiver_accepted_at, guardian_*) are not yet applied on remote DB
    if (errMsg.includes('public_token') || errMsg.includes('waiver_accepted_at') || errMsg.includes('guardian_')) {
      const { data: fallbackData, error: fallbackErr } = await adminDb
        .from('riding_requests')
        .insert({
          human_id: humanId,
          casual_customer_id: casualCustomerId,
          member_id: null,
          request_type: data.requestType,
          preferred_date: data.preferredDate,
          preferred_time_start: normalizedTime,
          height_cm: data.heightCm,
          weight_kg: data.weightKg,
          shoe_size: data.shoeSize,
          status: 'UNDER_REVIEW',
        })
        .select('id')
        .single();

      if (!fallbackErr && fallbackData) {
        recordId = fallbackData.id;
        savedToken = fallbackData.id; // Fallback token to UUID if column missing
        lastInsertErr = null;
        break;
      }
      lastInsertErr = fallbackErr;
    }

    break;
  }

  if (lastInsertErr || !recordId) {
    return {
      ok: false,
      error: 'Gagal mengirim permohonan sesi berkuda. Silakan coba lagi.',
      code: 'REQUEST_INSERT_FAILED',
    };
  }

  // 7. Notify Admins via notification_outbox
  const { data: admins } = await adminDb.from('users').select('id').eq('role', 'ADMIN');
  if (admins && admins.length > 0) {
    const notifications = admins.map((admin: { id: string }) => ({
      event_type: 'NEW_RIDING_REQUEST',
      aggregate_type: 'request',
      aggregate_id: recordId,
      recipient_user_id: admin.id,
      channel: 'FCM',
      payload: {
        request_id: humanId,
        type: data.requestType,
        member_name: `${data.fullName} (Tamu)`,
        public_token: savedToken,
      },
    }));
    await adminDb.from('notification_outbox').insert(notifications);
  }

  return {
    ok: true,
    requestId: humanId,
    recordId,
    publicToken: savedToken,
    requestType: data.requestType,
  };
}

export type ApproveRidingRequestInput = {
  requestId: string;
  date: string;
  time: string;
  capacity: number;
  actorId: string;
  priceIdr?: number | null;
};

export type ApproveRidingRequestResult =
  | { ok: true; bookingId: string }
  | { ok: false; code: string; message: string };

export async function approveRidingRequestWithDb(
  db: any,
  input: ApproveRidingRequestInput
): Promise<ApproveRidingRequestResult> {
  const { requestId, date, time, capacity, actorId, priceIdr } = input;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;

  // 1. Call the canonical 6-param RPC (from migration 0053)
  const { data: rpcBookingId, error: rpcError } = await db.rpc('approve_riding_request', {
    p_request_id: requestId,
    p_date: date,
    p_time: normalizedTime,
    p_capacity: capacity,
    p_actor_id: actorId,
    p_price_idr: priceIdr ?? null,
  });

  if (!rpcError && rpcBookingId) {
    return { ok: true, bookingId: rpcBookingId };
  }

  const errMsg = String(rpcError?.message || '');

  // Map known domain exceptions immediately
  if (errMsg.includes('SLOT_FULL')) {
    return {
      ok: false,
      code: 'SLOT_FULL',
      message: 'Slot pada tanggal & jam tersebut sudah penuh (SLOT_FULL).',
    };
  }
  if (errMsg.includes('SLOT_CLOSED')) {
    return {
      ok: false,
      code: 'SLOT_CLOSED',
      message: 'Slot pada jam tersebut sedang ditutup (SLOT_CLOSED).',
    };
  }
  if (errMsg.includes('REQUEST_NOT_FOUND')) {
    return {
      ok: false,
      code: 'REQUEST_NOT_FOUND',
      message: 'Permohonan riding tidak ditemukan.',
    };
  }
  if (errMsg.includes('REQUEST_NOT_UNDER_REVIEW') || errMsg.includes('INVALID_REQUEST_STATUS')) {
    return {
      ok: false,
      code: 'REQUEST_NOT_UNDER_REVIEW',
      message: 'Permohonan ini sudah pernah diproses sebelumnya.',
    };
  }

  // Fallback path if remote DB hasn't run migration 0053 yet (e.g. old 5-arg RPC signature, participant_identity_valid on CASUAL, or NOT_CHECKED_IN enum missing on staging)
  const isSignatureOrConstraintMismatch =
    errMsg.includes('p_price_idr') ||
    errMsg.includes('function') ||
    errMsg.includes('participant_identity_valid') ||
    errMsg.includes('NOT_CHECKED_IN') ||
    errMsg.includes('attendance_status') ||
    errMsg.includes('checkin') ||
    errMsg.includes('check_in') ||
    errMsg.includes('Fallback');

  if (!isSignatureOrConstraintMismatch && rpcError) {
    return {
      ok: false,
      code: 'RPC_ERROR',
      message: errMsg || 'Gagal menyetujui riding request.',
    };
  }

  // Execute safe step-by-step approval (supports both CASUAL and MEMBER branches + capacity check)
  const { data: reqRow, error: reqFetchErr } = await db
    .from('riding_requests')
    .select('id, human_id, status, request_type, member_id, casual_customer_id')
    .eq('id', requestId)
    .single();

  if (reqFetchErr || !reqRow) {
    return { ok: false, code: 'REQUEST_NOT_FOUND', message: 'Permohonan riding tidak ditemukan.' };
  }

  if (reqRow.status !== 'UNDER_REVIEW') {
    return {
      ok: false,
      code: 'REQUEST_NOT_UNDER_REVIEW',
      message: 'Permohonan ini sudah pernah diproses sebelumnya.',
    };
  }

  // Find or create session_slot
  let { data: slotRow } = await db
    .from('session_slots')
    .select('id, slot_date, start_time, capacity, is_open')
    .eq('slot_date', date)
    .eq('start_time', normalizedTime)
    .maybeSingle();

  if (!slotRow) {
    const startH = parseInt(normalizedTime.split(':')[0], 10);
    const endH = String(startH + 1).padStart(2, '0');
    const endM = normalizedTime.split(':')[1] || '00';
    const { data: createdSlot, error: createSlotErr } = await db
      .from('session_slots')
      .insert({
        slot_date: date,
        start_time: normalizedTime,
        end_time: `${endH}:${endM}:00`,
        block: startH < 12 ? 'MORNING' : 'AFTERNOON',
        capacity: capacity || 2,
        is_open: true,
      })
      .select('id, slot_date, start_time, capacity, is_open')
      .single();

    if (createSlotErr || !createdSlot) {
      return { ok: false, code: 'SLOT_CREATE_FAILED', message: 'Gagal membuat slot jadwal.' };
    }
    slotRow = createdSlot;
  }

  if (!slotRow.is_open) {
    return { ok: false, code: 'SLOT_CLOSED', message: 'Slot pada jam tersebut sedang ditutup.' };
  }

  // Re-check slot occupancy
  const { data: existingBookings } = await db
    .from('bookings')
    .select('id, status, booking_participants(id)')
    .eq('slot_id', slotRow.id)
    .in('status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED']);

  const currentOccupancy = (existingBookings || []).reduce(
    (sum: number, b: any) => sum + ((b.booking_participants || []).length || 0),
    0
  );

  if (currentOccupancy + 1 > (slotRow.capacity || capacity || 2)) {
    return {
      ok: false,
      code: 'SLOT_FULL',
      message: 'Slot pada tanggal & jam tersebut sudah penuh (SLOT_FULL).',
    };
  }

  const resolvedPrice =
    priceIdr != null
      ? Number(priceIdr)
      : reqRow.request_type === 'JOY_RIDE'
      ? 150000
      : 250000;

  // Insert CONFIRMED booking
  const { data: createdBooking, error: bookingInsertErr } = await db
    .from('bookings')
    .insert({
      slot_id: slotRow.id,
      status: 'CONFIRMED',
      is_casual: true,
      created_by: actorId,
      notes: `Created from riding request ${reqRow.human_id || reqRow.id}`,
    })
    .select('id')
    .single();

  if (bookingInsertErr || !createdBooking) {
    return { ok: false, code: 'BOOKING_INSERT_FAILED', message: 'Gagal membuat data booking.' };
  }

  // Insert participant: CASUAL branch vs MEMBER branch
  const baseParticipantPayload = reqRow.casual_customer_id
    ? {
        booking_id: createdBooking.id,
        participant_type: 'CASUAL',
        casual_customer_id: reqRow.casual_customer_id,
        member_id: null,
        price_idr: resolvedPrice,
        participant_status: 'CONFIRMED',
      }
    : {
        booking_id: createdBooking.id,
        participant_type: 'MEMBER',
        member_id: reqRow.member_id,
        casual_customer_id: null,
        price_idr: resolvedPrice,
        participant_status: 'CONFIRMED',
      };

  let { error: partErr } = await db.from('booking_participants').insert({
    ...baseParticipantPayload,
    attendance_status: 'NOT_CHECKED_IN',
  });

  if (partErr) {
    // Fallback if staging DB attendance_status enum does not yet have NOT_CHECKED_IN or has a checkin constraint
    const retryRes = await db.from('booking_participants').insert({
      ...baseParticipantPayload,
      attendance_status: null,
    });
    partErr = retryRes.error;
  }

  if (partErr) {
    return {
      ok: false,
      code: 'PARTICIPANT_INSERT_FAILED',
      message: partErr.message || 'Gagal menambahkan peserta booking.',
    };
  }

  // Update riding_requests status to CONFIRMED
  await db
    .from('riding_requests')
    .update({
      status: 'CONFIRMED',
      booking_id: createdBooking.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  return { ok: true, bookingId: createdBooking.id };
}
