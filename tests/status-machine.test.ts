import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from '../src/domain/booking/status-machine.js';

describe('Section 18 — booking state machine', () => {
  it('allows the documented PENDING transitions', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('PENDING', 'REJECTED')).toBe(true);
    expect(canTransition('PENDING', 'EXPIRED')).toBe(true);
  });

  it('allows the documented CONFIRMED transitions', () => {
    for (const to of ['COMPLETED', 'MEMBER_CANCELLED', 'BBS_CANCELLED', 'RESCHEDULE_REQUESTED', 'NO_SHOW'] as const) {
      expect(canTransition('CONFIRMED', to)).toBe(true);
    }
  });

  it('rejects arbitrary jumps', () => {
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'CONFIRMED')).toBe(false);
    expect(canTransition('MEMBER_CANCELLED', 'CONFIRMED')).toBe(false);
    expect(() => assertTransition('EXPIRED', 'CONFIRMED')).toThrow(/INVALID_BOOKING_STATUS/);
  });

  it('treats cancelled and expired bookings as terminal', () => {
    for (const s of ['REJECTED', 'EXPIRED', 'COMPLETED', 'NO_SHOW'] as const) {
      expect(canTransition(s, 'CONFIRMED')).toBe(false);
    }
  });
});
