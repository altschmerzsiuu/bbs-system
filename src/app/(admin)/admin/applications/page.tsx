import { getPendingRequests } from '@/modules/bookings/booking-queries';
import AdminReviewRequestsClient from './AdminReviewRequestsClient';

export default async function AdminReviewRequestsPage() {
  const requests = await getPendingRequests();

  return <AdminReviewRequestsClient initialRequests={requests} />;
}
