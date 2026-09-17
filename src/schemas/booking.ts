import { z } from 'zod';

const uuid = z.string().uuid();

export const participantSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MEMBER'),
    memberId: uuid,
  }),
  z.object({
    type: z.literal('CASUAL'),
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
  })
]);

export const createMemberBookingSchema = z.object({
  slotId: uuid,
  participants: z.array(participantSchema).min(1),
});

export const cancelBookingSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().max(500).optional(),
  acknowledgeLateForfeit: z.boolean().default(false), // Section 23 warning gate
});

export const requestRescheduleSchema = z.object({
  bookingId: uuid,
  newSlotId: uuid,
});

export const rejectBookingSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().max(500),
});

export const resolveAttendanceSchema = z.object({
  participantId: uuid,
  status: z.enum(['ATTENDED', 'NO_SHOW']),
  creditAction: z.enum(['CONSUMED', 'RETURNED']),
  reason: z.enum(['WEATHER', 'HORSE_CONDITION', 'MEMBER_EMERGENCY', 'BBS_DECISION', 'OTHER'])
    .optional(),
  notes: z.string().trim().max(500).optional(),
});

export const assignHorseSchema = z.object({
  participantId: uuid,
  horseId: uuid.nullable(),
});

export const createCasualBookingSchema = z.object({
  slotId: uuid,
  customer: z.union([
    z.object({ existingCustomerId: uuid }),
    z.object({
      fullName: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(20),
      email: z.string().email().optional(),
      notes: z.string().trim().max(500).optional(),
    }),
  ]),
});

export type ParticipantInput = z.infer<typeof participantSchema>;
export type CreateMemberBookingInput = z.infer<typeof createMemberBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type RequestRescheduleInput = z.infer<typeof requestRescheduleSchema>;
export type RejectBookingInput = z.infer<typeof rejectBookingSchema>;
export type ResolveAttendanceInput = z.infer<typeof resolveAttendanceSchema>;
export type AssignHorseInput = z.infer<typeof assignHorseSchema>;
