import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizePhoneToE164,
  calculateAge,
  resetGuestRateLimitForTests,
  submitGuestRideWithDb,
  approveRidingRequestWithDb,
} from '../src/modules/bookings/guest-ride-service';

describe('Guest Casual / Fun Ride Flow', () => {
  beforeEach(() => {
    resetGuestRateLimitForTests();
  });

  describe('normalizePhoneToE164', () => {
    it('normalizes 08xx, 628xx, 8xx, and +628xx to +628xx', () => {
      expect(normalizePhoneToE164('0812-3456-7890')).toBe('+6281234567890');
      expect(normalizePhoneToE164('6281234567890')).toBe('+6281234567890');
      expect(normalizePhoneToE164('81234567890')).toBe('+6281234567890');
      expect(normalizePhoneToE164('+62 812 3456 7890')).toBe('+6281234567890');
    });
  });

  describe('calculateAge', () => {
    it('calculates age accurately relative to reference date', () => {
      const ref = new Date('2026-11-14T00:00:00');
      expect(calculateAge('2012-05-10', ref)).toBe(14);
      expect(calculateAge('2000-01-15', ref)).toBe(26);
    });
  });

  describe('submitGuestRideWithDb', () => {
    const validAdultPayload = {
      fullName: 'Raka Pratama',
      phone: '081234567890',
      dateOfBirth: '1998-04-12',
      domicile: 'Balikpapan',
      heightCm: 172,
      weightKg: 68,
      shoeSize: 42,
      requestType: 'CASUAL_RIDE',
      preferredDate: '2026-11-20',
      preferredTime: '15:00',
      waiverAccepted: 'true',
      website: '',
    };

    it('rejects honeypot spam submissions', async () => {
      const mockDb = { from: vi.fn() };
      const res = await submitGuestRideWithDb(
        mockDb,
        { ...validAdultPayload, website: 'https://spam.example.com' },
        { skipTurnstile: true }
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('SPAM_DETECTED');
      }
      expect(mockDb.from).not.toHaveBeenCalled();
    });

    it('requires guardianName and guardianPhone when rider is under 17', async () => {
      const mockDb = { from: vi.fn() };
      const minorWithoutGuardian = {
        ...validAdultPayload,
        dateOfBirth: '2015-06-01',
        guardianName: '',
        guardianPhone: '',
      };

      const res = await submitGuestRideWithDb(mockDb, minorWithoutGuardian, {
        skipTurnstile: true,
        now: new Date('2026-11-14T10:00:00Z'),
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('VALIDATION_ERROR');
        expect(res.error).toContain('wali');
      }
    });

    it('upserts casual_customers by normalized +62 phone, retries on human_id collision, and inserts UNDER_REVIEW riding_requests', async () => {
      const insertedRequests: any[] = [];
      const insertedOutbox: any[] = [];
      let insertAttempt = 0;

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === 'casual_customers') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
              upsert: vi.fn((payload: any) => {
                expect(payload.phone).toBe('+6281234567890');
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'casual-uuid-1' },
                      error: null,
                    }),
                  })),
                };
              }),
            };
          }

          if (table === 'riding_requests') {
            return {
              insert: vi.fn((payload: any) => {
                insertAttempt++;
                insertedRequests.push(payload);
                return {
                  select: vi.fn(() => ({
                    single: vi.fn().mockImplementation(async () => {
                      if (insertAttempt === 1) {
                        // Simulate unique collision on first human_id attempt
                        return {
                          data: null,
                          error: { code: '23505', message: 'duplicate key value violates unique constraint "riding_requests_human_id_key"' },
                        };
                      }
                      return {
                        data: { id: 'req-uuid-1', public_token: payload.public_token },
                        error: null,
                      };
                    }),
                  })),
                };
              }),
            };
          }

          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 'admin-user-1' }],
                  error: null,
                }),
              })),
            };
          }

          if (table === 'notification_outbox') {
            return {
              insert: vi.fn(async (rows: any[]) => {
                insertedOutbox.push(...rows);
                return { error: null };
              }),
            };
          }

          throw new Error(`Unexpected table: ${table}`);
        }),
      };

      const res = await submitGuestRideWithDb(
        mockDb,
        {
          ...validAdultPayload,
          dateOfBirth: '2014-03-10',
          guardianName: 'Bapak Hendra',
          guardianPhone: '081122334455',
        },
        { skipTurnstile: true, clientIp: '203.0.113.10', now: new Date('2026-11-14T10:00:00Z') }
      );

      expect(res.ok).toBe(true);
      expect(insertAttempt).toBe(2); // Retried after collision
      if (res.ok) {
        expect(res.requestId).toMatch(/^BBS-REQ-141126-\d{4}$/);
        expect(res.publicToken).toMatch(/^[a-f0-9]{32}$/);
        expect(res.requestType).toBe('CASUAL_RIDE');
      }

      const finalInsert = insertedRequests[1];
      expect(finalInsert.casual_customer_id).toBe('casual-uuid-1');
      expect(finalInsert.member_id).toBeNull();
      expect(finalInsert.status).toBe('UNDER_REVIEW');
      expect(finalInsert.guardian_name).toBe('Bapak Hendra');
      expect(finalInsert.guardian_phone).toBe('+6281122334455');
      expect(finalInsert.waiver_accepted_at).toBeTruthy();
      expect(insertedOutbox).toHaveLength(1);
      expect(insertedOutbox[0].event_type).toBe('NEW_RIDING_REQUEST');
    });

    it('enforces per-phone rate limit on repeated rapid submissions', async () => {
      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === 'casual_customers') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'casual-1' }, error: null }),
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            };
          }
          if (table === 'riding_requests') {
            return {
              insert: vi.fn((p: any) => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'req-1', public_token: p.public_token },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === 'users') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            };
          }
          return {};
        }),
      };

      const fixedNow = new Date('2026-11-14T10:00:00Z');
      for (let i = 0; i < 5; i++) {
        const r = await submitGuestRideWithDb(mockDb, validAdultPayload, {
          skipTurnstile: true,
          now: fixedNow,
        });
        expect(r.ok).toBe(true);
      }

      const sixth = await submitGuestRideWithDb(mockDb, validAdultPayload, {
        skipTurnstile: true,
        now: fixedNow,
      });
      expect(sixth.ok).toBe(false);
      if (!sixth.ok) {
        expect(sixth.code).toBe('RATE_LIMITED');
      }
    });
  });

  describe('approveRidingRequestWithDb (CASUAL & MEMBER branches + SLOT_FULL)', () => {
    it('calls approve_riding_request RPC with p_price_idr and returns bookingId', async () => {
      const mockDb = {
        rpc: vi.fn().mockResolvedValue({ data: 'booking-casual-123', error: null }),
      };

      const res = await approveRidingRequestWithDb(mockDb, {
        requestId: 'req-1',
        date: '2026-11-20',
        time: '15:00',
        capacity: 2,
        actorId: 'admin-1',
        priceIdr: 250000,
      });

      expect(res).toEqual({ ok: true, bookingId: 'booking-casual-123' });
      expect(mockDb.rpc).toHaveBeenCalledWith('approve_riding_request', {
        p_request_id: 'req-1',
        p_date: '2026-11-20',
        p_time: '15:00:00',
        p_capacity: 2,
        p_actor_id: 'admin-1',
        p_price_idr: 250000,
      });
    });

    it('returns SLOT_FULL when RPC raises SLOT_FULL', async () => {
      const mockDb = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'SLOT_FULL' },
        }),
      };

      const res = await approveRidingRequestWithDb(mockDb, {
        requestId: 'req-1',
        date: '2026-11-20',
        time: '15:00:00',
        capacity: 2,
        actorId: 'admin-1',
        priceIdr: 250000,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('SLOT_FULL');
      }
    });

    it('creates participant with participant_type="CASUAL", casual_customer_id, and price_idr in fallback CASUAL branch', async () => {
      const insertedParticipants: any[] = [];
      let updatedRequest: any = null;

      const mockDb = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Could not find the function public.approve_riding_request(p_actor_id, p_capacity, p_date, p_price_idr, p_request_id, p_time)' },
        }),
        from: vi.fn((table: string) => {
          if (table === 'riding_requests') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'req-casual-1',
                      human_id: 'BBS-REQ-141126-1234',
                      status: 'UNDER_REVIEW',
                      request_type: 'CASUAL_RIDE',
                      member_id: null,
                      casual_customer_id: 'casual-cust-99',
                    },
                    error: null,
                  }),
                })),
              })),
              update: vi.fn((payload: any) => {
                updatedRequest = payload;
                return {
                  eq: vi.fn().mockResolvedValue({ error: null }),
                };
              }),
            };
          }
          if (table === 'session_slots') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'slot-1',
                        slot_date: '2026-11-20',
                        start_time: '15:00:00',
                        capacity: 2,
                        is_open: true,
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          }
          if (table === 'bookings') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    data: [{ id: 'b-existing', status: 'CONFIRMED', booking_participants: [{ id: 'p-1' }] }],
                    error: null,
                  }),
                })),
              })),
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'booking-new-casual' },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === 'booking_participants') {
            return {
              insert: vi.fn(async (payload: any) => {
                insertedParticipants.push(payload);
                return { error: null };
              }),
            };
          }
          return {};
        }),
      };

      const res = await approveRidingRequestWithDb(mockDb, {
        requestId: 'req-casual-1',
        date: '2026-11-20',
        time: '15:00',
        capacity: 2,
        actorId: 'admin-1',
        priceIdr: 275000,
      });

      expect(res).toEqual({ ok: true, bookingId: 'booking-new-casual' });
      expect(insertedParticipants).toHaveLength(1);
      expect(insertedParticipants[0]).toMatchObject({
        booking_id: 'booking-new-casual',
        participant_type: 'CASUAL',
        casual_customer_id: 'casual-cust-99',
        member_id: null,
        price_idr: 275000,
        participant_status: 'CONFIRMED',
      });
      expect(updatedRequest).toMatchObject({
        status: 'CONFIRMED',
        booking_id: 'booking-new-casual',
      });
    });

    it('rejects with SLOT_FULL when slot occupancy reaches capacity in fallback check', async () => {
      const mockDb = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'function signature p_price_idr fallback' },
        }),
        from: vi.fn((table: string) => {
          if (table === 'riding_requests') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'req-casual-2',
                      human_id: 'BBS-REQ-141126-5678',
                      status: 'UNDER_REVIEW',
                      request_type: 'JOY_RIDE',
                      member_id: null,
                      casual_customer_id: 'casual-cust-100',
                    },
                    error: null,
                  }),
                })),
              })),
            };
          }
          if (table === 'session_slots') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'slot-full-1',
                        slot_date: '2026-11-20',
                        start_time: '15:00:00',
                        capacity: 2,
                        is_open: true,
                      },
                      error: null,
                    }),
                  })),
                })),
              })),
            };
          }
          if (table === 'bookings') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'b-1',
                        status: 'CONFIRMED',
                        booking_participants: [{ id: 'p-1' }, { id: 'p-2' }],
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };

      const res = await approveRidingRequestWithDb(mockDb, {
        requestId: 'req-casual-2',
        date: '2026-11-20',
        time: '15:00',
        capacity: 2,
        actorId: 'admin-1',
        priceIdr: 150000,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('SLOT_FULL');
      }
    });
  });
});
