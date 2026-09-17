import type { CreditTxnType } from '../credit/ledger.js';

export type CancellationSource = 'MEMBER' | 'BBS';

export interface CancellationOutcome {
  isLate: boolean;
  newStatus: 'MEMBER_CANCELLED' | 'BBS_CANCELLED';
  creditTxn: CreditTxnType;
  creditReturned: boolean;
}

/**
 * Section 23 — the deadline is configuration, never a literal.
 * BBS-side cancellation always returns the credit regardless of timing.
 */
export function resolveCancellation(params: {
  sessionStartsAt: Date;
  now: Date;
  source: CancellationSource;
  deadlineHours: number;
}): CancellationOutcome {
  const { sessionStartsAt, now, source, deadlineHours } = params;
  if (source === 'BBS') {
    return {
      isLate: false,
      newStatus: 'BBS_CANCELLED',
      creditTxn: 'BBS_CANCELLATION_RETURN',
      creditReturned: true,
    };
  }
  const deadline = new Date(sessionStartsAt.getTime() - deadlineHours * 60 * 60 * 1000);
  const isLate = now.getTime() > deadline.getTime();
  return {
    isLate,
    newStatus: 'MEMBER_CANCELLED',
    creditTxn: isLate ? 'LATE_CANCELLATION' : 'EARLY_CANCELLATION_RETURN',
    creditReturned: !isLate,
  };
}
