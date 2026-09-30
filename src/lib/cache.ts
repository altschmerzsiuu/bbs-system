import { revalidatePath } from 'next/cache';

/**
 * Revalidates all paths across both Member and Admin applications that
 * depend on booking state. This ensures that a mutation made by one side
 * is immediately visible to the other without stale cache issues.
 */
export function revalidateBookingPaths() {
  // Member paths
  revalidatePath('/home');
  revalidatePath('/bookings');
  revalidatePath('/schedule');
  
  // Admin paths
  revalidatePath('/admin/schedule', 'layout'); // covers /admin/schedule and /admin/schedule/[slotId]
  revalidatePath('/admin/bookings');
}
