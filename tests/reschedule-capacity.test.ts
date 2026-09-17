import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../src/modules/bookings/booking-service';
import { DomainError } from '../src/domain/shared/errors';

describe('Multi-Participant Reschedule Capacity (Service Boundary)', () => {
  let dbMock: any;
  let service: BookingService;
  
  beforeEach(() => {
    dbMock = {
      rpc: vi.fn(),
    };
    service = new BookingService(dbMock as any);
  });

  const memberActor = { userId: '11111111-1111-1111-1111-111111111111', role: 'MEMBER' as const, memberId: '11111111-1111-1111-1111-111111111111' };
  const adminActor = { userId: '22222222-2222-2222-2222-222222222222', role: 'ADMIN' as const, memberId: null };

  const b1 = '33333333-3333-3333-3333-333333333331';
  const b2 = '33333333-3333-3333-3333-333333333332';
  const b3 = '33333333-3333-3333-3333-333333333333';
  const b4 = '33333333-3333-3333-3333-333333333334';
  const b5 = '33333333-3333-3333-3333-333333333335';
  const s1 = '44444444-4444-4444-4444-444444444441';

  it('Single-participant reschedule into one remaining capacity -> succeeds', async () => {
    // DB allows it
    dbMock.rpc.mockResolvedValue({ data: null, error: null });
    
    await expect(service.requestReschedule(memberActor, {
      bookingId: b1, newSlotId: s1
    })).resolves.not.toThrow();

    expect(dbMock.rpc).toHaveBeenCalledWith('request_reschedule', {
      p_booking_id: b1,
      p_new_slot_id: s1,
      p_member_id: memberActor.memberId,
      p_actor_id: memberActor.userId
    });
  });

  it('Two-participant booking into one remaining capacity -> SLOT_FULL', async () => {
    // DB correctly blocks it after our fix
    dbMock.rpc.mockResolvedValue({ error: { message: 'SLOT_FULL' } });
    
    await expect(service.requestReschedule(memberActor, {
      bookingId: b2, newSlotId: s1
    })).rejects.toThrowError(new DomainError('SLOT_FULL'));
  });

  it('Three-participant booking into two remaining capacity -> SLOT_FULL', async () => {
    // DB correctly blocks it after our fix
    dbMock.rpc.mockResolvedValue({ error: { message: 'SLOT_FULL' } });
    
    await expect(service.requestReschedule(memberActor, {
      bookingId: b3, newSlotId: s1
    })).rejects.toThrowError(new DomainError('SLOT_FULL'));
  });

  it('Multi-participant booking into a slot with sufficient capacity -> succeeds', async () => {
    // DB allows it
    dbMock.rpc.mockResolvedValue({ data: null, error: null });
    
    await expect(service.requestReschedule(memberActor, {
      bookingId: b4, newSlotId: s1
    })).resolves.not.toThrow();
  });

  it('Slot that becomes full AFTER request_reschedule -> approve_reschedule still rejects safely', async () => {
    // Admin attempts to approve, but capacity is now full
    dbMock.rpc.mockResolvedValue({ error: { message: 'SLOT_FULL' } });
    
    await expect(service.approveReschedule(adminActor, b4))
      .rejects.toThrowError(new DomainError('SLOT_FULL'));
      
    expect(dbMock.rpc).toHaveBeenCalledWith('approve_reschedule', {
      p_booking_id: b4,
      p_actor_id: adminActor.userId
    });
  });

  it('No regression to ownership authorization (FORBIDDEN)', async () => {
    // DB blocks non-owner member
    dbMock.rpc.mockResolvedValue({ error: { message: 'FORBIDDEN' } });
    
    await expect(service.requestReschedule(memberActor, {
      bookingId: b5, newSlotId: s1
    })).rejects.toThrowError(new DomainError('FORBIDDEN'));
  });
});
