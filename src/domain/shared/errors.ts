/**
 * Section 47 — structured, client-safe application errors.
 * The SQL layer raises these same codes as exception messages; the
 * infrastructure layer maps them back into DomainError instances so the
 * domain vocabulary is identical on both sides of the database boundary.
 */
export const DOMAIN_ERROR_CODES = [
  'BOOKING_WINDOW_EXCEEDED',
  'ACTIVE_BOOKING_LIMIT_REACHED',
  'SLOT_FULL',
  'SLOT_CLOSED',
  'SLOT_NOT_FOUND',
  'SLOT_IN_PAST',
  'MEMBERSHIP_EXPIRED',
  'INSUFFICIENT_CREDITS',
  'INVALID_BOOKING_STATUS',
  'CANCELLATION_DEADLINE_PASSED',
  'INVALID_RESCHEDULE',
  'PARTICIPANT_LIMIT_REACHED',
  'BOOKING_NOT_FOUND',
  'PARTICIPANT_NOT_FOUND',
  'UNAUTHORIZED',
  'INVALID_APPLICATION_STATUS',
  'DUPLICATE_APPLICATION',
  'PLAN_NOT_FOUND',
  'APPLICATION_NOT_FOUND',
  'FORBIDDEN',
  'HORSE_ALREADY_ASSIGNED_IN_SLOT',
  'HORSE_NOT_FOUND',
  'HORSE_INACTIVE',
  'DUPLICATE_PARTICIPANT',
  'ALREADY_BOOKED_FOR_SLOT',
  'DAILY_BOOKING_LIMIT_REACHED',
  'WEEKLY_BOOKING_LIMIT_REACHED',
  'NO_PARTICIPANTS',
  'INVALID_PARTICIPANT_TYPE',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

const MESSAGES: Record<DomainErrorCode, string> = {
  BOOKING_WINDOW_EXCEEDED: 'This session is outside the booking window.',
  ACTIVE_BOOKING_LIMIT_REACHED: 'You already have the maximum number of upcoming bookings.',
  SLOT_FULL: 'This session is already full.',
  SLOT_CLOSED: 'This session is closed.',
  SLOT_NOT_FOUND: 'Session not found.',
  SLOT_IN_PAST: 'This session has already passed.',
  MEMBERSHIP_EXPIRED: 'No active membership covers this session date.',
  INSUFFICIENT_CREDITS: 'You have no session credits available.',
  INVALID_BOOKING_STATUS: 'This booking cannot change to that state.',
  CANCELLATION_DEADLINE_PASSED: 'The cancellation deadline has passed.',
  INVALID_RESCHEDULE: 'This reschedule request is not valid.',
  PARTICIPANT_LIMIT_REACHED: 'This session has no space left.',
  BOOKING_NOT_FOUND: 'Booking not found.',
  PARTICIPANT_NOT_FOUND: 'Participant not found.',
  UNAUTHORIZED: 'You need to sign in.',
  INVALID_APPLICATION_STATUS: 'Status aplikasi tidak valid untuk operasi ini',
  DUPLICATE_APPLICATION: 'Anda sudah memiliki aplikasi yang sedang diproses',
  PLAN_NOT_FOUND: 'Paket membership tidak ditemukan',
  APPLICATION_NOT_FOUND: 'Aplikasi tidak ditemukan',
  FORBIDDEN: 'Anda tidak memiliki akses untuk operasi ini',
  HORSE_ALREADY_ASSIGNED_IN_SLOT: 'Horse is already assigned to another participant in this session.',
  HORSE_NOT_FOUND: 'Horse not found.',
  HORSE_INACTIVE: 'Horse is currently inactive and cannot be assigned.',
  DUPLICATE_PARTICIPANT: 'Duplicate participant in booking.',
  ALREADY_BOOKED_FOR_SLOT: 'Participant is already booked for this session.',
  DAILY_BOOKING_LIMIT_REACHED: 'Setiap member hanya dapat memesan maksimal 2 sesi dalam sehari.',
  WEEKLY_BOOKING_LIMIT_REACHED: 'Anda telah mencapai batas maksimal pemesanan per minggu.',
  NO_PARTICIPANTS: 'A booking must have at least one participant.',
  INVALID_PARTICIPANT_TYPE: 'Invalid participant type specified.',
};

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(MESSAGES[code]);
    this.name = 'DomainError';
  }
}

export function isDomainErrorCode(value: string): value is DomainErrorCode {
  return (DOMAIN_ERROR_CODES as readonly string[]).includes(value);
}

/** Never leak Postgres internals to the client (Section 47). */
export function toClientError(error: unknown): { code: string; message: string } {
  if (error instanceof DomainError) return { code: error.code, message: error.message };
  const raw = error instanceof Error ? error.message : '';
  if (isDomainErrorCode(raw)) return { code: raw, message: MESSAGES[raw] };
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
}
