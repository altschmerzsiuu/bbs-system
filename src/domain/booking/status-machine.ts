/** Section 18 — the only place a booking transition is allowed to be decided. */
export const BOOKING_STATUSES = [
  'PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'COMPLETED',
  'MEMBER_CANCELLED', 'BBS_CANCELLED', 'RESCHEDULE_REQUESTED', 'NO_SHOW',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'EXPIRED', 'MEMBER_CANCELLED', 'BBS_CANCELLED'],
  CONFIRMED: ['COMPLETED', 'MEMBER_CANCELLED', 'BBS_CANCELLED', 'RESCHEDULE_REQUESTED', 'NO_SHOW'],
  RESCHEDULE_REQUESTED: ['CONFIRMED', 'REJECTED', 'MEMBER_CANCELLED', 'BBS_CANCELLED'],
  REJECTED: [],
  EXPIRED: [],
  COMPLETED: [],
  MEMBER_CANCELLED: [],
  BBS_CANCELLED: [],
  NO_SHOW: [],
};

export const TERMINAL_STATUSES = BOOKING_STATUSES.filter((s) => TRANSITIONS[s].length === 0);

/** Statuses that occupy capacity in a slot (Section 12). */
export const CAPACITY_HOLDING_STATUSES: readonly BookingStatus[] = [
  'PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'NO_SHOW',
];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`INVALID_BOOKING_STATUS: ${from} -> ${to}`);
  }
}
