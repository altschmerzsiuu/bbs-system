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

    // Check constraints for members (Weekly limit & no duplicate booking on same slot)
    if (memberIds.size > 0) {
      let adminDb = this.db;
      try {
        const { createServiceRoleClient } = await import('../../infrastructure/supabase-server');
        adminDb = createServiceRoleClient() as any;
      } catch {
        // Fallback to this.db in test environments
      }

      const { data: slotData } = await adminDb
        .from('session_slots')
        .select('slot_date, is_open')
        .eq('id', parsed.slotId)
        .single();
      if (!slotData) throw new DomainError('SLOT_NOT_FOUND');
      if (slotData.is_open === false) throw new DomainError('SLOT_CLOSED');

      // 1. Prevent duplicate booking on the exact same slot
      const { data: existingSlotBookings } = await adminDb
        .from('booking_participants')
        .select('member_id, bookings!inner(id, slot_id, status)')
        .in('member_id', Array.from(memberIds))
        .eq('bookings.slot_id', parsed.slotId)
        .in('bookings.status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED']);

      if (existingSlotBookings && existingSlotBookings.length > 0) {
        throw new DomainError('ALREADY_BOOKED_FOR_SLOT');
      }

      // 2. Fetch dynamic weekly limit from site_settings (configured by admin)
      const { data: siteSettings } = await adminDb
        .from('site_settings')
        .select('max_weekly_bookings')
        .eq('id', 1)
        .single();

      const configuredLimit = siteSettings?.max_weekly_bookings ?? 4;
      const maxAllowed = configuredLimit === 999 ? 999 : configuredLimit;

      // 3. Enforce weekly frequency limit if not unlimited (999)
      if (maxAllowed !== 999) {
        const [y, m, d] = slotData.slot_date.split('-').map(Number);
        const targetDate = new Date(y, m - 1, d);
        const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 1 is Monday...
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const monday = new Date(targetDate);
        monday.setDate(targetDate.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;

        const { data: weekSlots } = await adminDb
          .from('session_slots')
          .select('id')
          .gte('slot_date', mondayStr)
          .lte('slot_date', sundayStr);

        const weekSlotIds = weekSlots?.map((s: any) => s.id) || [];

        if (weekSlotIds.length > 0) {
          // Check bookings created by this user
          const { data: weekBookings } = await adminDb
            .from('bookings')
            .select('id, slot_id, status')
            .eq('created_by', actor.userId)
            .in('slot_id', weekSlotIds)
            .in('status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'COMPLETED']);

          // Check bookings where this member is a participant
          const { data: participantBookings } = await adminDb
            .from('booking_participants')
            .select('booking_id, bookings!inner(id, slot_id, status)')
            .in('member_id', Array.from(memberIds))
            .in('bookings.slot_id', weekSlotIds)
            .in('bookings.status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'COMPLETED']);

          const allBookingIds = new Set<string>();
          (weekBookings || []).forEach((b: any) => allBookingIds.add(b.id));
          (participantBookings || []).forEach((p: any) => allBookingIds.add(p.booking_id));

          if (allBookingIds.size >= maxAllowed) {
            throw new DomainError('WEEKLY_BOOKING_LIMIT_REACHED');
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
    const bookingId = data as string;
    if (parsed.notes) {
      let adminDb = this.db;
      try {
        const { createServiceRoleClient } = await import('../../infrastructure/supabase-server');
        adminDb = createServiceRoleClient() as any;
      } catch {
        // Fallback to this.db in test environments
      }
      await adminDb.from('bookings').update({ notes: parsed.notes }).eq('id', bookingId);
    }
    return bookingId;
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
