import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../src/modules/bookings/booking-service';
import { DomainError } from '../src/domain/shared/errors';

describe('BookingService', () => {
  let dbMock: any;
  let service: BookingService;
  
  beforeEach(() => {
    dbMock = {
      rpc: vi.fn(),
    };
    service = new BookingService(dbMock as any);
  });

  const memberActor = { userId: 'u1', role: 'MEMBER' as const, memberId: 'm1' };
  const adminActor = { userId: 'a1', role: 'ADMIN' as const, memberId: null };
  const groomerActor = { userId: 'g1', role: 'GROOMER' as const, memberId: null };

  describe('createMemberBooking', () => {
    it('throws FORBIDDEN if actor is not a member', async () => {
      await expect(service.createMemberBooking(adminActor, { 
        slotId: '00000000-0000-0000-0000-000000000000', 
        participants: [{ type: 'MEMBER', memberId: '00000000-0000-0000-0000-000000000000' }] 
      })).rejects.toThrowError(DomainError);
    });

    it('correctly maps participants and calls rpc', async () => {
      dbMock.rpc.mockResolvedValue({ data: 'booking-id', error: null });

      const res = await service.createMemberBooking(memberActor, {
        slotId: '11111111-1111-1111-1111-111111111111',
        participants: [
          { type: 'MEMBER', memberId: '22222222-2222-2222-2222-222222222222' },
          { type: 'CASUAL', fullName: 'Budi', phone: '0812345678' }
        ]
      });

      expect(res).toBe('booking-id');
      expect(dbMock.rpc).toHaveBeenCalledWith('create_member_booking', {
        p_booking_owner_id: 'm1',
        p_slot_id: '11111111-1111-1111-1111-111111111111',
        p_participants: [
          { type: 'MEMBER', member_id: '22222222-2222-2222-2222-222222222222' },
          { type: 'CASUAL', full_name: 'Budi', phone: '0812345678' }
        ],
        p_actor_id: 'u1'
      });
    });
  });

  describe('admin rejection', () => {
    it('rejectBooking calls reject_booking rpc', async () => {
      dbMock.rpc.mockResolvedValue({ error: null });
      await service.rejectBooking(adminActor, {
        bookingId: '11111111-1111-1111-1111-111111111111',
        reason: 'Too full'
      });
      expect(dbMock.rpc).toHaveBeenCalledWith('reject_booking', {
        p_booking_id: '11111111-1111-1111-1111-111111111111',
        p_actor_id: 'a1',
        p_reason: 'Too full'
      });
    });

    it('rejectReschedule calls reject_reschedule rpc', async () => {
      dbMock.rpc.mockResolvedValue({ error: null });
      await service.rejectReschedule(adminActor, {
        bookingId: '11111111-1111-1111-1111-111111111111',
        reason: 'Not allowed'
      });
      expect(dbMock.rpc).toHaveBeenCalledWith('reject_reschedule', {
        p_booking_id: '11111111-1111-1111-1111-111111111111',
        p_actor_id: 'a1',
        p_reason: 'Not allowed'
      });
    });
  });

  describe('reschedule approval', () => {
    it('approveReschedule calls approve_reschedule rpc', async () => {
      dbMock.rpc.mockResolvedValue({ error: null });
      await service.approveReschedule(adminActor, '11111111-1111-1111-1111-111111111111');
      expect(dbMock.rpc).toHaveBeenCalledWith('approve_reschedule', {
        p_booking_id: '11111111-1111-1111-1111-111111111111',
        p_actor_id: 'a1',
      });
    });
  });

  describe('resolveAttendance', () => {
    it('calls resolve_attendance rpc', async () => {
      dbMock.rpc.mockResolvedValue({ error: null });
      await service.resolveAttendance(adminActor, {
        participantId: '33333333-3333-3333-3333-333333333333',
        status: 'NO_SHOW',
        creditAction: 'RETURNED',
        reason: 'WEATHER'
      });
      expect(dbMock.rpc).toHaveBeenCalledWith('resolve_attendance', {
        p_participant_id: '33333333-3333-3333-3333-333333333333',
        p_status: 'NO_SHOW',
        p_credit_action: 'RETURNED',
        p_reason: 'WEATHER',
        p_actor_id: 'a1'
      });
    });
  });
  describe('assignHorse', () => {
    it('throws FORBIDDEN if actor is not ADMIN or GROOMER', async () => {
      await expect(service.assignHorse(memberActor, {
        participantId: '44444444-4444-4444-4444-444444444444',
        horseId: '55555555-5555-5555-5555-555555555555',
      })).rejects.toThrowError(DomainError);
    });

    it('allows GROOMER to assign horse', async () => {
      dbMock.rpc.mockResolvedValue({ error: null });
      await service.assignHorse(groomerActor, {
        participantId: '44444444-4444-4444-4444-444444444444',
        horseId: '55555555-5555-5555-5555-555555555555',
      });
      expect(dbMock.rpc).toHaveBeenCalledWith('assign_horse', {
        p_participant_id: '44444444-4444-4444-4444-444444444444',
        p_horse_id: '55555555-5555-5555-5555-555555555555',
        p_actor_id: 'g1'
      });
    });

    it('maps HORSE_ALREADY_ASSIGNED_IN_SLOT to DomainError', async () => {
      dbMock.rpc.mockResolvedValue({ error: { message: 'HORSE_ALREADY_ASSIGNED_IN_SLOT' } });
      await expect(service.assignHorse(adminActor, {
        participantId: '44444444-4444-4444-4444-444444444444',
        horseId: '55555555-5555-5555-5555-555555555555',
      })).rejects.toThrowError(new DomainError('HORSE_ALREADY_ASSIGNED_IN_SLOT'));
    });

    it('maps HORSE_INACTIVE to DomainError', async () => {
      dbMock.rpc.mockResolvedValue({ error: { message: 'HORSE_INACTIVE' } });
      await expect(service.assignHorse(adminActor, {
        participantId: '44444444-4444-4444-4444-444444444444',
        horseId: '55555555-5555-5555-5555-555555555555',
      })).rejects.toThrowError(new DomainError('HORSE_INACTIVE'));
    });

    it('maps HORSE_NOT_FOUND to DomainError', async () => {
      dbMock.rpc.mockResolvedValue({ error: { message: 'HORSE_NOT_FOUND' } });
      await expect(service.assignHorse(adminActor, {
        participantId: '44444444-4444-4444-4444-444444444444',
        horseId: '55555555-5555-5555-5555-555555555555',
      })).rejects.toThrowError(new DomainError('HORSE_NOT_FOUND'));
    });

    it('calls assign_horse rpc when success', async () => {
      dbMock.rpc.mockResolvedValue({ error: null });
      await service.assignHorse(adminActor, {
        participantId: '44444444-4444-4444-4444-444444444444',
        horseId: '55555555-5555-5555-5555-555555555555',
      });
      expect(dbMock.rpc).toHaveBeenCalledWith('assign_horse', {
        p_participant_id: '44444444-4444-4444-4444-444444444444',
        p_horse_id: '55555555-5555-5555-5555-555555555555',
        p_actor_id: 'a1'
      });
    });
  });
});
