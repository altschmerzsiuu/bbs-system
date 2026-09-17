/**
 * Section 15/33 — credit state is always derived from the ledger.
 * available = allocated - reserved - consumed. Nothing overwrites a balance.
 */
export const CREDIT_TXN_TYPES = [
  'MEMBERSHIP_ALLOCATION', 'SESSION_RESERVED', 'SESSION_COMPLETED',
  'EARLY_CANCELLATION_RETURN', 'LATE_CANCELLATION', 'BBS_CANCELLATION_RETURN',
  'NO_SHOW_DEDUCT', 'NO_SHOW_RETURN', 'ADMIN_ADJUSTMENT', 'EXPIRATION',
] as const;
export type CreditTxnType = (typeof CREDIT_TXN_TYPES)[number];

export interface LedgerEntry {
  txnType: CreditTxnType;
  deltaAllocated: number;
  deltaReserved: number;
  deltaConsumed: number;
}

export interface CreditState {
  allocated: number;
  reserved: number;
  consumed: number;
  available: number;
}

/** The canonical shape of each transaction type, shared with the SQL layer. */
export const TXN_EFFECT: Record<CreditTxnType, Omit<LedgerEntry, 'txnType'>> = {
  MEMBERSHIP_ALLOCATION:     { deltaAllocated: 1, deltaReserved: 0,  deltaConsumed: 0 },
  SESSION_RESERVED:          { deltaAllocated: 0, deltaReserved: 1,  deltaConsumed: 0 },
  SESSION_COMPLETED:         { deltaAllocated: 0, deltaReserved: -1, deltaConsumed: 1 },
  EARLY_CANCELLATION_RETURN: { deltaAllocated: 0, deltaReserved: -1, deltaConsumed: 0 },
  LATE_CANCELLATION:         { deltaAllocated: 0, deltaReserved: -1, deltaConsumed: 1 },
  BBS_CANCELLATION_RETURN:   { deltaAllocated: 0, deltaReserved: -1, deltaConsumed: 0 },
  NO_SHOW_DEDUCT:            { deltaAllocated: 0, deltaReserved: -1, deltaConsumed: 1 },
  NO_SHOW_RETURN:            { deltaAllocated: 0, deltaReserved: -1, deltaConsumed: 0 },
  ADMIN_ADJUSTMENT:          { deltaAllocated: 0, deltaReserved: 0,  deltaConsumed: 0 },
  EXPIRATION:                { deltaAllocated: 0, deltaReserved: 0,  deltaConsumed: 0 },
};

export function creditState(entries: LedgerEntry[]): CreditState {
  const allocated = entries.reduce((n, e) => n + e.deltaAllocated, 0);
  const reserved = entries.reduce((n, e) => n + e.deltaReserved, 0);
  const consumed = entries.reduce((n, e) => n + e.deltaConsumed, 0);
  return { allocated, reserved, consumed, available: allocated - reserved - consumed };
}
