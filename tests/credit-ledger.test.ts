import { describe, expect, it } from 'vitest';
import { creditState, TXN_EFFECT, type LedgerEntry } from '../src/domain/credit/ledger.js';
import { resolveCancellation } from '../src/domain/booking/cancellation-policy.js';

const entry = (txnType: keyof typeof TXN_EFFECT, times = 1): LedgerEntry[] =>
  Array.from({ length: times }, () => ({ txnType, ...TXN_EFFECT[txnType] }));

const goldAllocation = entry('MEMBERSHIP_ALLOCATION', 10);

describe('Section 15/33 — credit ledger', () => {
  it('allocates the locked GOLD credits', () => {
    expect(creditState(goldAllocation).available).toBe(10);
  });

  it('reserves on confirmation without consuming', () => {
    const s = creditState([...goldAllocation, ...entry('SESSION_RESERVED')]);
    expect(s).toMatchObject({ reserved: 1, consumed: 0, available: 9 });
  });

  it('consumes the reserved credit on completion — never twice', () => {
    const s = creditState([...goldAllocation, ...entry('SESSION_RESERVED'), ...entry('SESSION_COMPLETED')]);
    expect(s).toMatchObject({ reserved: 0, consumed: 1, available: 9 });
  });

  it('returns the credit on early cancellation', () => {
    const s = creditState([...goldAllocation, ...entry('SESSION_RESERVED'), ...entry('EARLY_CANCELLATION_RETURN')]);
    expect(s.available).toBe(10);
  });

  it('forfeits the credit on late cancellation', () => {
    const s = creditState([...goldAllocation, ...entry('SESSION_RESERVED'), ...entry('LATE_CANCELLATION')]);
    expect(s).toMatchObject({ consumed: 1, available: 9 });
  });

  it('returns the credit when BBS cancels', () => {
    const s = creditState([...goldAllocation, ...entry('SESSION_RESERVED'), ...entry('BBS_CANCELLATION_RETURN')]);
    expect(s.available).toBe(10);
  });

  it('honours both no-show resolutions', () => {
    const base = [...goldAllocation, ...entry('SESSION_RESERVED')];
    expect(creditState([...base, ...entry('NO_SHOW_DEDUCT')]).available).toBe(9);
    expect(creditState([...base, ...entry('NO_SHOW_RETURN')]).available).toBe(10);
  });

  it('never leaves a negative available balance for a SILVER plan', () => {
    const silver = entry('MEMBERSHIP_ALLOCATION', 5);
    const s = creditState([...silver, ...entry('SESSION_RESERVED', 5), ...entry('SESSION_COMPLETED', 5)]);
    expect(s.available).toBe(0);
  });
});

describe('Section 23 — cancellation policy', () => {
  const start = new Date('2026-09-20T16:00:00+08:00');

  it('returns the credit before the 6-hour deadline', () => {
    const out = resolveCancellation({
      sessionStartsAt: start, now: new Date('2026-09-20T09:00:00+08:00'),
      source: 'MEMBER', deadlineHours: 6,
    });
    expect(out).toMatchObject({ isLate: false, creditTxn: 'EARLY_CANCELLATION_RETURN', creditReturned: true });
  });

  it('forfeits the credit after the deadline', () => {
    const out = resolveCancellation({
      sessionStartsAt: start, now: new Date('2026-09-20T12:00:00+08:00'),
      source: 'MEMBER', deadlineHours: 6,
    });
    expect(out).toMatchObject({ isLate: true, creditTxn: 'LATE_CANCELLATION', creditReturned: false });
  });

  it('always returns the credit when BBS cancels, even late', () => {
    const out = resolveCancellation({
      sessionStartsAt: start, now: new Date('2026-09-20T15:59:00+08:00'),
      source: 'BBS', deadlineHours: 6,
    });
    expect(out).toMatchObject({ newStatus: 'BBS_CANCELLED', creditReturned: true });
  });

  it('reads the deadline from configuration, not a literal', () => {
    const out = resolveCancellation({
      sessionStartsAt: start, now: new Date('2026-09-20T09:00:00+08:00'),
      source: 'MEMBER', deadlineHours: 12,
    });
    expect(out.isLate).toBe(true);
  });
});
