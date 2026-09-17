import { describe, expect, it } from 'vitest';
import {
  generateDaySlots, generateSlotsForSchedule, type OperatingScheduleConfig,
} from '../src/domain/schedule/slot-generation.js';

const morning: OperatingScheduleConfig = {
  dayOfWeek: 1, block: 'MORNING', startTime: '07:00', endTime: '11:00',
  sessionDurationMinutes: 45, slotIntervalMinutes: 60, defaultCapacity: 2, isActive: true,
};
const afternoon: OperatingScheduleConfig = {
  ...morning, block: 'AFTERNOON', startTime: '13:00', endTime: '18:00',
};

describe('Section 64.18 — generated schedule must match the locked timetable', () => {
  it('generates exactly the four morning sessions', () => {
    expect(generateSlotsForSchedule(morning).map((s) => `${s.startTime}-${s.endTime}`))
      .toEqual(['07:00-07:45', '08:00-08:45', '09:00-09:45', '10:00-10:45']);
  });

  it('generates exactly the five afternoon sessions', () => {
    expect(generateSlotsForSchedule(afternoon).map((s) => `${s.startTime}-${s.endTime}`))
      .toEqual(['13:00-13:45', '14:00-14:45', '15:00-15:45', '16:00-16:45', '17:00-17:45']);
  });

  it('never generates an 11:00 morning session', () => {
    expect(generateSlotsForSchedule(morning).some((s) => s.startTime === '11:00')).toBe(false);
  });

  it('leaves the 12:00-13:00 break empty', () => {
    const day = generateDaySlots([morning, afternoon], 1);
    expect(day.some((s) => s.startTime.startsWith('11') || s.startTime.startsWith('12'))).toBe(false);
  });

  it('never generates half-hour starts even if interval is misconfigured', () => {
    const misconfigured = { ...morning, slotIntervalMinutes: 30 };
    expect(generateSlotsForSchedule(misconfigured).every((s) => s.startTime.endsWith(':00'))).toBe(true);
  });

  it('skips inactive days', () => {
    expect(generateSlotsForSchedule({ ...morning, isActive: false })).toEqual([]);
  });

  it('applies configured capacity rather than a literal', () => {
    expect(generateSlotsForSchedule({ ...morning, defaultCapacity: 4 })[0]?.capacity).toBe(4);
  });
});
