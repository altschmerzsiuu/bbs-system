export const dynamic = 'force-dynamic';
import { getPendingRequests } from '@/modules/bookings/booking-queries';
import AdminReviewRequestsClient from './AdminReviewRequestsClient';

export default async function AdminReviewRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const requests = await getPendingRequests();

  return <AdminReviewRequestsClient initialRequests={requests} defaultTab={resolvedParams?.tab} />;
}
