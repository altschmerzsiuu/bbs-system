/**
 * Section 41 — pure slot generation. This mirrors generate_session_slots() in
 * SQL so the rule ("a slot exists only if the whole session fits in the block")
 * can be unit-tested without a database.
 */
export interface OperatingScheduleConfig {
  dayOfWeek: number;            // 0 = Sunday
  block: 'MORNING' | 'AFTERNOON';
  startTime: string;            // "07:00"
  endTime: string;              // "11:00"
  sessionDurationMinutes: number;
  slotIntervalMinutes: number;
  defaultCapacity: number;
  isActive: boolean;
}

export interface GeneratedSlot {
  startTime: string;
  endTime: string;
  block: 'MORNING' | 'AFTERNOON';
  capacity: number;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m ?? 0);
};

const toHHMM = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function generateSlotsForSchedule(schedule: OperatingScheduleConfig): GeneratedSlot[] {
  if (!schedule.isActive) return [];
  const slots: GeneratedSlot[] = [];
  const blockStart = toMinutes(schedule.startTime);
  const blockEnd = toMinutes(schedule.endTime);

  for (let start = blockStart; start + schedule.sessionDurationMinutes <= blockEnd;
       start += schedule.slotIntervalMinutes) {
    // Section 9: hourly starts only. A misconfigured interval must never
    // silently produce half-hour sessions.
    if (start % 60 !== 0) continue;
    slots.push({
      startTime: toHHMM(start),
      endTime: toHHMM(start + schedule.sessionDurationMinutes),
      block: schedule.block,
      capacity: schedule.defaultCapacity,
    });
  }
  return slots;
}

export function generateDaySlots(schedules: OperatingScheduleConfig[], dayOfWeek: number): GeneratedSlot[] {
  return schedules
    .filter((s) => s.dayOfWeek === dayOfWeek)
    .flatMap(generateSlotsForSchedule)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
