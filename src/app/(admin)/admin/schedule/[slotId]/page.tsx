import { getAdminSessionDetail } from '@/modules/bookings/booking-queries';
import AdminSessionDetailClient from './AdminSessionDetailClient';
import { createServerClient } from '@/infrastructure/supabase-server';

interface AdminSessionDetailPageProps {
    params: Promise<{
        slotId: string;
    }>;
}

export default async function AdminSessionDetailPage({
    params,
}: AdminSessionDetailPageProps) {
    const { slotId } = await params;

    const db = await createServerClient();
    const session = await getAdminSessionDetail(slotId);
    const { data: horses } = await db.from('horses').select('*').eq('status', 'ACTIVE').order('name');

    return (
        <AdminSessionDetailClient
            session={session}
            horses={horses || []}
        />
    );
}