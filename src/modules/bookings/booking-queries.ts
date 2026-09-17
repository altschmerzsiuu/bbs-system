import { createServerClient } from '@/infrastructure/supabase-server';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'COMPLETED' | 'MEMBER_CANCELLED' | 'BBS_CANCELLED' | 'RESCHEDULE_REQUESTED' | 'NO_SHOW';

export interface MemberHomeData {
  memberName: string;
  nextBooking: { id: string; date: string; startTime: string; endTime: string; status: BookingStatus; sharedWith: string[] } | null;
  membership: { plan: string; allocated: number; used: number; available: number; endDate: string } | null;
  pendingApplication: { id: string; status: string; type: string; planName: string; finalPrice: number } | null;
  upcomingCount: number;
  unreadNotifications: number;
}

/**
 * Query baca untuk Member Home. Satu round-trip per entitas, tanpa N+1:
 * participant, slot dan peserta lain diambil lewat embed, bukan loop.
 * RLS yang membatasi baris — query ini tidak menambah filter keamanan sendiri.
 */
export async function getMemberHome(memberId: string): Promise<MemberHomeData> {
  const db = await createServerClient();

  const [memberRes, membershipRes, bookingRes, notifRes, appRes] = await Promise.all([
    db.from('members').select('full_name').eq('id', memberId).single(),

    db.from('memberships')
      .select('id, allocated_credits, end_date, membership_plans(name)')
      .eq('member_id', memberId).eq('status', 'ACTIVE').maybeSingle(),

    db.from('booking_participants')
      .select(`
        booking_id,
        bookings!inner (
          id, status,
          session_slots!inner ( slot_date, start_time, end_time ),
          booking_participants ( members ( full_name ), casual_customers ( full_name ) )
        )
      `)
      .eq('member_id', memberId)
      .in('bookings.status', ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'])
      .gte('bookings.session_slots.slot_date', new Date().toISOString().slice(0, 10))
      .order('slot_date', { referencedTable: 'bookings.session_slots', ascending: true }),

    db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),

    db.from('membership_applications')
      .select('id, status, application_type, final_price_idr, membership_plans(name)')
      .eq('member_id', memberId)
      .in('status', ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_CONFIRMED'])
      .maybeSingle()
  ]);

  const membershipRow = membershipRes.data as any;
  let membership: MemberHomeData['membership'] = null;

  if (membershipRow) {
    // Saldo selalu diturunkan dari ledger, tidak pernah dibaca dari kolom.
    const { data: state } = await db.rpc('membership_credit_state', {
      p_membership_id: membershipRow.id,
    });
    const s = Array.isArray(state) ? state[0] : state;
    membership = {
      plan: membershipRow.membership_plans?.name ?? '—',
      allocated: membershipRow.allocated_credits,
      used: (s?.reserved ?? 0) + (s?.consumed ?? 0),
      available: s?.available ?? 0,
      endDate: membershipRow.end_date,
    };
  }

  const rows = (bookingRes.data ?? []) as any[];
  const first = rows[0]?.bookings;
  const appData = appRes.data as any;

  return {
    memberName: memberRes.data?.full_name ?? 'Rider',
    nextBooking: first
      ? {
          id: first.id,
          date: first.session_slots.slot_date,
          startTime: first.session_slots.start_time.slice(0, 5),
          endTime: first.session_slots.end_time.slice(0, 5),
          status: first.status,
          sharedWith: (first.booking_participants ?? [])
            .map((p: any) => p.members?.full_name ?? p.casual_customers?.full_name)
            .filter((n: string | undefined): n is string => Boolean(n) && n !== memberRes.data?.full_name),
        }
      : null,
    membership,
    pendingApplication: appData
      ? {
          id: appData.id,
          status: appData.status,
          type: appData.application_type,
          planName: appData.membership_plans?.name ?? 'Plan',
          finalPrice: appData.final_price_idr,
        }
      : null,
    upcomingCount: rows.length,
    unreadNotifications: notifRes.count ?? 0,
  };
}
