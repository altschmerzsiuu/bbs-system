import { getAdminSchedule } from './src/modules/bookings/booking-queries';

async function test() {
  try {
    const slots = await getAdminSchedule('2026-09-21');
    console.log("Date: 2026-09-21");
    for (const slot of slots) {
      console.log(`${slot.startTime} slotExists ${slot.slotExists}`);
      if (slot.slotExists && slot.booking) {
        console.log(`      Booking: ${slot.booking.participants.length} participants`);
      }
    }
  } catch (error) {
    console.error(error);
  }
}
test();
