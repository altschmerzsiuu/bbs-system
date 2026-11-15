export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createServiceRoleClient } from '@/infrastructure/supabase-server';
import GuestRideStatusClient, { type GuestRideStatusViewModel } from './status-client';

export default async function GuestRideStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cleanToken = String(token || '').trim();

  // Basic token sanity check (hex token 16-64 chars or UUID)
  if (!/^[a-fA-F0-9-]{16,64}$/.test(cleanToken)) {
    return <NotFoundView />;
  }

  const adminDb = createServiceRoleClient();

  const selectFull = `
    id,
    human_id,
    public_token,
    request_type,
    status,
    preferred_date,
    preferred_time_start,
    height_cm,
    weight_kg,
    shoe_size,
    waiver_accepted_at,
    guardian_name,
    guardian_phone,
    booking_id,
    created_at,
    casual_customers ( full_name, phone, notes ),
    members ( full_name, phone ),
    bookings (
      id,
      status,
      notes,
      session_slots!bookings_slot_id_fkey ( slot_date, start_time, end_time ),
      booking_participants (
        id,
        price_idr,
        attendance_status,
        horses ( name ),
        attendance_records ( status )
      )
    )
  `;

  let { data: reqRow, error: reqErr } = await adminDb
    .from('riding_requests')
    .select(selectFull)
    .eq('public_token', cleanToken)
    .maybeSingle();

  // Fallback if public_token column isn't migrated yet and token is a UUID
  if ((reqErr || !reqRow) && /^[0-9a-fA-F-]{36}$/.test(cleanToken)) {
    const fallbackRes = await adminDb
      .from('riding_requests')
      .select(`
        id,
        human_id,
        request_type,
        status,
        preferred_date,
        preferred_time_start,
        height_cm,
        weight_kg,
        shoe_size,
        booking_id,
        created_at,
        casual_customers ( full_name, phone, notes ),
        members ( full_name, phone ),
        bookings (
          id,
          status,
          notes,
          session_slots!bookings_slot_id_fkey ( slot_date, start_time, end_time ),
          booking_participants (
            id,
            price_idr,
            attendance_status,
            horses ( name ),
            attendance_records ( status )
          )
        )
      `)
      .eq('id', cleanToken)
      .maybeSingle();
    reqRow = fallbackRes.data as any;
  }

  if (!reqRow) {
    return <NotFoundView />;
  }

  const [productsRes, settingsRes] = await Promise.all([
    adminDb.from('ride_products').select('code, name, price_idr').eq('is_active', true),
    adminDb.from('site_settings').select('admin_whatsapp').eq('id', 1).maybeSingle(),
  ]);

  const products = productsRes.data || [];
  const matchedProduct = products.find((p: any) => p.code === reqRow.request_type);
  const defaultPriceIdr = matchedProduct
    ? Number(matchedProduct.price_idr)
    : reqRow.request_type === 'JOY_RIDE'
    ? 150000
    : 250000;

  const casual = Array.isArray(reqRow.casual_customers)
    ? reqRow.casual_customers[0]
    : reqRow.casual_customers;
  const member = Array.isArray(reqRow.members) ? reqRow.members[0] : reqRow.members;

  // If booking wasn't linked via booking_id foreign key (e.g. older approve function), try looking up by notes
  let bookingObj: any = Array.isArray(reqRow.bookings) ? reqRow.bookings[0] : reqRow.bookings;
  if (!bookingObj && reqRow.status === 'CONFIRMED') {
    const { data: fallbackBooking } = await adminDb
      .from('bookings')
      .select(`
        id,
        status,
        notes,
        session_slots!bookings_slot_id_fkey ( slot_date, start_time, end_time ),
        booking_participants (
          id,
          price_idr,
          attendance_status,
          horses ( name ),
          attendance_records ( status )
        )
      `)
      .ilike('notes', `%${reqRow.human_id}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    bookingObj = fallbackBooking;
  }

  const slot = bookingObj
    ? Array.isArray(bookingObj.session_slots)
      ? bookingObj.session_slots[0]
      : bookingObj.session_slots
    : null;
  const participant = bookingObj?.booking_participants?.[0] || null;
  const horse = participant?.horses
    ? Array.isArray(participant.horses)
      ? participant.horses[0]
      : participant.horses
    : null;

  const finalPriceIdr =
    participant?.price_idr != null ? Number(participant.price_idr) : defaultPriceIdr;

  const viewModel: GuestRideStatusViewModel = {
    id: reqRow.id,
    humanId: reqRow.human_id,
    publicToken: (reqRow as any).public_token || reqRow.id,
    requestType: reqRow.request_type,
    serviceName:
      matchedProduct?.name ||
      (reqRow.request_type === 'JOY_RIDE' ? 'Joy Ride' : 'Casual / Fun Ride'),
    status: reqRow.status,
    riderName: casual?.full_name || member?.full_name || 'Tamu BBS',
    riderPhone: casual?.phone || member?.phone || '',
    preferredDate: reqRow.preferred_date,
    preferredTime: String(reqRow.preferred_time_start || '').slice(0, 5),
    heightCm: Number(reqRow.height_cm) || 0,
    weightKg: Number(reqRow.weight_kg) || 0,
    shoeSize: reqRow.shoe_size ?? null,
    guardianName: (reqRow as any).guardian_name || null,
    guardianPhone: (reqRow as any).guardian_phone || null,
    priceIdr: finalPriceIdr,
    createdAt: reqRow.created_at,
    booking: bookingObj
      ? {
          id: bookingObj.id,
          status: bookingObj.status,
          date: slot?.slot_date || reqRow.preferred_date,
          startTime: String(slot?.start_time || reqRow.preferred_time_start || '').slice(0, 5),
          endTime: slot?.end_time ? String(slot.end_time).slice(0, 5) : null,
          horseName: horse?.name || null,
          attendanceStatus:
            participant?.attendance_records?.[0]?.status ||
            participant?.attendance_status ||
            'NOT_CHECKED_IN',
        }
      : null,
  };

  const adminWa = settingsRes.data?.admin_whatsapp || '628123194014';

  return <GuestRideStatusClient data={viewModel} adminWa={adminWa} />;
}

function NotFoundView() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--white)',
          padding: '32px 24px',
          borderRadius: '24px',
          maxWidth: '400px',
          width: '100%',
          border: '1px solid #e6e2d8',
        }}
      >
        <h1 style={{ font: '28px var(--font-display)', color: 'var(--ink)', margin: '0 0 8px' }}>
          Tiket Tidak Ditemukan
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 24px' }}>
          Link tiket yang Anda buka tidak valid atau sudah tidak berlaku. Anda dapat mencari kembali tiket menggunakan nomor WhatsApp Anda.
        </p>
        <Link
          href="/ride?tab=check"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '50px',
            background: 'var(--ink)',
            color: 'var(--white)',
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '14px',
            textDecoration: 'none',
          }}
        >
          Cari Tiket dengan Nomor WA
        </Link>
      </div>
    </div>
  );
}
