export const dynamic = 'force-dynamic';

import { createServiceRoleClient } from '@/infrastructure/supabase-server';
import { ensureSlotsForDateRange } from '@/modules/bookings/booking-queries';
import GuestRideForm, { type RideProductItem } from './guest-ride-form';

const DEFAULT_PRODUCTS: RideProductItem[] = [
  {
    code: 'CASUAL_RIDE',
    name: 'Casual / Fun Ride',
    description: 'Sesi berkuda sekali jalan (60 menit) didampingi instruktur profesional.',
    price_idr: 250000,
  },
  {
    code: 'JOY_RIDE',
    name: 'Joy Ride',
    description: 'Pengenalan berkuda santai mengelilingi area stable & sesi foto bersama kuda.',
    price_idr: 150000,
  },
];

export default async function PublicGuestRidePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const initialMode = params.type === 'joyride' ? 'JOY_RIDE' : 'CASUAL_RIDE';
  const initialTab = params.tab === 'check' ? 'check' : 'book';

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(now);
  const nextWeek = new Date(`${todayStr}T00:00:00Z`);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  await ensureSlotsForDateRange(todayStr, nextWeekStr);

  const adminDb = createServiceRoleClient();

  const [productsRes, slotsRes, settingsRes] = await Promise.all([
    adminDb
      .from('ride_products')
      .select('code, name, description, price_idr, is_active')
      .eq('is_active', true)
      .order('price_idr', { ascending: false }),
    adminDb
      .from('session_slots')
      .select('id, slot_date, start_time, end_time, capacity, is_open')
      .gte('slot_date', todayStr)
      .lte('slot_date', nextWeekStr)
      .eq('is_open', true)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true }),
    adminDb.from('site_settings').select('admin_whatsapp').eq('id', 1).maybeSingle(),
  ]);

  const products: RideProductItem[] =
    !productsRes.error && productsRes.data && productsRes.data.length > 0
      ? productsRes.data.map((p: any) => ({
          code: p.code,
          name: p.name,
          description: p.description || '',
          price_idr: Number(p.price_idr) || 0,
        }))
      : DEFAULT_PRODUCTS;

  const slots = slotsRes.data || [];
  const adminWa = settingsRes.data?.admin_whatsapp || '628123194014';

  return (
    <GuestRideForm
      products={products}
      slots={slots}
      initialMode={initialMode}
      initialTab={initialTab}
      adminWa={adminWa}
    />
  );
}
