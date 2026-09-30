export const dynamic = 'force-dynamic';
import { getAdminSchedule, ensureSlotsForDateRange } from '@/modules/bookings/booking-queries';
import type { AdminScheduleSlot } from '@/modules/bookings/booking-types';
import AdminScheduleClient3 from './AdminScheduleClient3';

interface AdminSchedulePageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function AdminSchedulePage({
  searchParams,
}: AdminSchedulePageProps) {
  const params = await searchParams;

  const today = new Date().toISOString().split('T')[0];
  const date = params.date ?? today;

  let slots: AdminScheduleSlot[] = [];

  try {
    await ensureSlotsForDateRange(date, date);
    slots = await getAdminSchedule(date);
  } catch (error) {
    console.error(error);
  }

  return (
    <AdminScheduleClient3
      initialSlots={slots}
      initialDate={date}
    />
  );
}