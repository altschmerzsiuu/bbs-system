import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from '../src/modules/memberships/membership-service';
import { DomainError } from '../src/domain/shared/errors';

describe('MembershipService', () => {
  let dbMock: any;
  let service: MembershipService;
  
  beforeEach(() => {
    dbMock = {
      from: vi.fn(),
      rpc: vi.fn(),
    };
    service = new MembershipService(dbMock as any);
  });

  const setupDbFrom = (chainFns: any) => {
    dbMock.from.mockReturnValue(chainFns);
  };

  const memberActor = { userId: 'u1', role: 'MEMBER' as const, memberId: 'm1' };
  const adminActor = { userId: 'a1', role: 'ADMIN' as const, memberId: null };

  it('rejects submitApplication if member already has pending application (App-layer check)', async () => {
    setupDbFrom({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'app1' } }) // Existing app
    });

    await expect(service.submitApplication(memberActor, { planId: 'p1' }))
      .rejects.toThrowError(DomainError);
  });

  it('identifies RENEWAL correctly if user has ANY past membership', async () => {
    // 1st call: existing apps -> null
    // 2nd call: plan details -> { data: { price_idr: 1000, extension_discount_idr: 200 } }
    // 3rd call: latest membership -> { data: { id: 'past_membership' } } (Even if expired!)
    // 4th call: insert

    const mockInsert = vi.fn().mockReturnThis();
    const mockSelectAfterInsert = vi.fn().mockReturnThis();
    
    let callIndex = 0;
    dbMock.from.mockImplementation(() => {
      return {
        select: vi.fn().mockImplementation(() => {
          return {
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => {
              if (callIndex === 0) {
                callIndex++;
                return Promise.resolve({ data: null }); // No existing app
              }
              if (callIndex === 2) {
                callIndex++;
                return Promise.resolve({ data: { id: 'expired123' } }); // Past membership exists!
              }
              return Promise.resolve({ data: null });
            }),
            single: vi.fn().mockImplementation(() => {
              if (callIndex === 1) {
                callIndex++;
                return Promise.resolve({ data: { id: 'p1', price_idr: 1000, extension_discount_idr: 200 } });
              }
              if (callIndex === 3) {
                return Promise.resolve({ data: { id: 'newapp' } });
              }
              return Promise.resolve({ data: null });
            })
          };
        }),
        insert: mockInsert,
      };
    });

    mockInsert.mockReturnValue({ select: mockSelectAfterInsert });
    mockSelectAfterInsert.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'newapp' } }) });

    await service.submitApplication(memberActor, { planId: 'p1' });

    // Assert that the insert payload had application_type = RENEWAL and correct final price
    const insertPayload = mockInsert.mock.calls[0][0];
    expect(insertPayload.application_type).toBe('RENEWAL');
    expect(insertPayload.previous_membership_id).toBe('expired123');
    expect(insertPayload.final_price_idr).toBe(800); // 1000 - 200
  });

  it('activates membership by calling the postgres RPC', async () => {
    dbMock.rpc.mockResolvedValue({ error: null });

    await service.activateMembership(adminActor, 'app123');

    expect(dbMock.rpc).toHaveBeenCalledWith('activate_membership', {
      p_application_id: 'app123',
      p_admin_id: 'a1',
    });
  });

  it('rejects activation if actor is MEMBER', async () => {
    await expect(service.activateMembership(memberActor, 'app123'))
      .rejects.toThrowError(DomainError);
  });
});
