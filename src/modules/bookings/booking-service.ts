import { DomainError, isDomainErrorCode } from '../../domain/shared/errors';
import {
  cancelBookingSchema, createMemberBookingSchema, requestRescheduleSchema, rejectBookingSchema, resolveAttendanceSchema, assignHorseSchema,
  type CancelBookingInput, type CreateMemberBookingInput, type RejectBookingInput, type ResolveAttendanceInput, type AssignHorseInput
} from '../../schemas/booking';
import type { SupabaseClient } from '../../infrastructure/types';

export interface ActorContext {
  userId: string;
  role: 'MEMBER' | 'ADMIN' | 'GROOMER';
  memberId: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
}

/** Postgres raises our domain codes as exception messages; translate them back. */
function rethrow(error: { message?: string } | null): never | void {
  if (!error) return;
  const code = (error.message ?? '').trim();
  if (isDomainErrorCode(code)) throw new DomainError(code);
  console.error('[BookingService Error]', error);
  throw new Error('INTERNAL_ERROR');
}

/**
 * Section 46 — the application-level operation. Authorization, validation and
 * the transactional call are all here; React never touches these rules.
 */
export class BookingService {
  constructor(private readonly db: SupabaseClient) {}

  async createMemberBooking(actor: ActorContext, input: CreateMemberBookingInput): Promise<string> {
    if (!actor.memberId) throw new DomainError('FORBIDDEN');
    const parsed = createMemberBookingSchema.parse(input);

    const memberIds = new Set<string>();
    const dbPayload = parsed.participants.map(p => {
      if (p.type === 'MEMBER') {
        if (memberIds.has(p.memberId)) {
          throw new DomainError('DUPLICATE_PARTICIPANT');
        }
        memberIds.add(p.memberId);
        return { type: 'MEMBER', member_id: p.memberId };
      }
      return { type: 'CASUAL', full_name: p.fullName, phone: p.phone };
    });

    // Check constraints for members (Max 2 sessions/day & no duplicate booking on same slot)
    if (memberIds.size > 0) {
      const { data: slotData } = await this.db.from('session_slots').select('slot_date').eq('id', parsed.slotId).single();
      if (!slotData) throw new DomainError('SLOT_NOT_FOUND');

      const { data: dailySlots } = await this.db.from('session_slots').select('id').eq('slot_date', slotData.slot_date);
      const dailySlotIds = dailySlots?.map((s: any) => s.id) || [];

      if (dailySlotIds.length > 0) {
        const { data: dailyBookings } = await this.db.from('booking_participants')
          .select('member_id, bookings!inner(slot_id, status)')
          .in('member_id', Array.from(memberIds))
          .in('bookings.slot_id', dailySlotIds)
          .in('bookings.status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED']);
          
        if (dailyBookings && dailyBookings.length > 0) {
          const counts: Record<string, number> = {};
          for (const b of dailyBookings) {
            if ((b.bookings as any).slot_id === parsed.slotId) {
              throw new DomainError('ALREADY_BOOKED_FOR_SLOT');
            }
            counts[b.member_id] = (counts[b.member_id] || 0) + 1;
          }

          for (const count of Object.values(counts)) {
            if (count >= 2) {
              throw new DomainError('DAILY_BOOKING_LIMIT_REACHED');
            }
          }
        }
      }
    }

    const { data, error } = await this.db.rpc('create_member_booking', {
      p_booking_owner_id: actor.memberId,
      p_slot_id: parsed.slotId,
      p_participants: dbPayload,
      p_actor_id: actor.userId,
    });
    rethrow(error);
    return data as string;
  }

  async approveBooking(actor: ActorContext, bookingId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');
    const { error } = await this.db.rpc('approve_booking', {
      p_booking_id: bookingId,
      p_actor_id: actor.userId,
    });
    rethrow(error);
  }

  async rejectBooking(actor: ActorContext, input: RejectBookingInput): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');
    const parsed = rejectBookingSchema.parse(input);
    const { error } = await this.db.rpc('reject_booking', {
      p_booking_id: parsed.bookingId,
      p_actor_id: actor.userId,
      p_reason: parsed.reason,
    });
    rethrow(error);
  }

  async cancelBooking(actor: ActorContext, input: CancelBookingInput): Promise<'EARLY' | 'LATE'> {
    const parsed = cancelBookingSchema.parse(input);
    const source = actor.role === 'ADMIN' ? 'BBS' : 'MEMBER';
    const { data, error } = await this.db.rpc('cancel_booking', {
      p_booking_id: parsed.bookingId,
      p_actor_id: actor.userId,
      p_source: source,
      p_reason: parsed.reason ?? null,
    });
    rethrow(error);
    return data as 'EARLY' | 'LATE';
  }

  async requestReschedule(actor: ActorContext, input: unknown): Promise<void> {
    if (!actor.memberId) throw new DomainError('FORBIDDEN');
    const { bookingId, newSlotId } = requestRescheduleSchema.parse(input);
    const { error } = await this.db.rpc('request_reschedule', {
      p_booking_id: bookingId,
      p_new_slot_id: newSlotId,
      p_member_id: actor.memberId,
      p_actor_id: actor.userId,
    });
    rethrow(error);
  }

  async approveReschedule(actor: ActorContext, bookingId: string): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');
    const { error } = await this.db.rpc('approve_reschedule', {
      p_booking_id: bookingId,
      p_actor_id: actor.userId,
    });
    rethrow(error);
  }

  async rejectReschedule(actor: ActorContext, input: RejectBookingInput): Promise<void> {
    if (actor.role !== 'ADMIN') throw new DomainError('FORBIDDEN');
    const parsed = rejectBookingSchema.parse(input);
    const { error } = await this.db.rpc('reject_reschedule', {
      p_booking_id: parsed.bookingId,
      p_actor_id: actor.userId,
      p_reason: parsed.reason,
    });
    rethrow(error);
  }

  async resolveAttendance(actor: ActorContext, input: ResolveAttendanceInput): Promise<void> {
    if (actor.role !== 'ADMIN' && actor.role !== 'GROOMER') throw new DomainError('FORBIDDEN');
    const parsed = resolveAttendanceSchema.parse(input);
    const { error } = await this.db.rpc('resolve_attendance', {
      p_participant_id: parsed.participantId,
      p_status: parsed.status,
      p_credit_action: parsed.creditAction,
      p_reason: parsed.reason ?? null,
      p_actor_id: actor.userId,
    });
    rethrow(error);
  }

  async assignHorse(actor: ActorContext, input: AssignHorseInput): Promise<void> {
    if (actor.role !== 'ADMIN' && actor.role !== 'GROOMER') throw new DomainError('FORBIDDEN');
    const parsed = assignHorseSchema.parse(input);
    const { error } = await this.db.rpc('assign_horse', {
      p_participant_id: parsed.participantId,
      p_horse_id: parsed.horseId,
      p_actor_id: actor.userId,
    });
    rethrow(error);
  }
}
