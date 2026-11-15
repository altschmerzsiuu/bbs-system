import { SupabaseClient } from '@supabase/supabase-js';

export interface AdminHomeStats {
  sessions: number;
  riders: number;
  spotsLeft: number;
}

export interface PendingRequestSummary {
  booking: number;
  reschedule: number;
  membership: number;
  riding: number;
  total: number;
}

export interface UpcomingSession {
  id: string;
  time: string; // HH:mm
  duration: number; // minutes
  riders: number;
  arena: string;
  names: string; // e.g. "Keisha, Sarah"
  status: 'Ready' | 'Upcoming' | 'Needs Horse' | 'Completed';
  rawTime: string;
  ridersList?: Array<{
    id: string;
    name: string;
    init: string;
    avatarUrl?: string | null;
    horseId?: string | null;
    horseName?: string | null;
    attendanceStatus: string;
  }>;
}

export interface CurrentSession {
  id: string;
  timeRange: string;
  arena: string;
  riders: Array<{
    init: string;
    name: string;
    id: string;
    attendanceStatus: string;
    avatarUrl?: string | null;
    horseId?: string | null;
    horseName?: string | null;
  }>;
  progressPercent: number;
  elapsedText: string;
  remainingText: string;
}

export interface OperationalAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  icon: string;
  title: string;
  message: string;
}

export async function getAdminHomeData(db: any) {
  // We use parallel queries to get data for today's dashboard
  
  // 1. Get today's sessions and bookings
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const [
    { data: slots },
    { count: membershipReqCount },
    { count: pendingBookingsCount },
    { count: pendingRescheduleCount },
    { count: ridingReqCount },
    { data: pendingBookingsList },
    expiringRes
  ] = await Promise.all([
    db.from('session_slots')
      .select(`
        id, slot_date, start_time, end_time, capacity,
        bookings!bookings_slot_id_fkey(id, status, booking_participants(id, participant_status, horse_id, horses(name), attendance_records(status), member_id, members(user_id, full_name, users(full_name, avatar_url)), casual_customers(full_name)))
      `)
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true }),
      
    db.from('membership_applications').select('*', { count: 'exact', head: true }).in('status', ['PENDING_REVIEW', 'PAYMENT_SUBMITTED']),
    
    db.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    
    db.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'RESCHEDULE_REQUESTED'),

    db.from('riding_requests').select('*', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),

    db.from('bookings')
      .select(`
        id, status, notes, created_at,
        session_slots!bookings_slot_id_fkey(id, slot_date, start_time, end_time),
        booking_participants(
          id, participant_type,
          members(full_name, phone),
          casual_customers(full_name, phone)
        )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(5),

    // Fetch expiring memberships for alerts
    db.from('memberships')
      .select('id, end_date, members(user_id, users(full_name)), packages(name)')
      .eq('status', 'ACTIVE')
      .lte('end_date', (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })())
      .gte('end_date', today)
  ]);


  // Compute stats
  let totalSessions = 0;
  let totalRiders = 0;
  let totalCapacity = 0;
  
  const upcoming: UpcomingSession[] = [];
  // Adjust 'now' to match local facility time (WITA / Asia/Makassar)
  const localTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  const now = new Date(localTimeStr);
  
  let currentSession: CurrentSession | null = null;
  
  if (slots) {
    for (const slot of slots) {
      const isToday = slot.slot_date === today;
      
      let slotRiders = 0;
      const riderNames: string[] = [];
      const riderInitials: Array<{
        init: string;
        name: string;
        id: string;
        attendanceStatus: string;
        avatarUrl?: string | null;
        horseId?: string | null;
        horseName?: string | null;
      }> = [];
      
      const validBookings = (slot.bookings as any[])?.filter(b => 
        ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'].includes(b.status)
      ) || [];
      for (const b of validBookings) {
        const participants = b.booking_participants || [];
        slotRiders += participants.length;
        
        for (const p of participants) {
          const memberObj = Array.isArray(p.members) ? p.members[0] : p.members;
          const casualObj = Array.isArray(p.casual_customers) ? p.casual_customers[0] : p.casual_customers;
          const userObj = Array.isArray(memberObj?.users) ? memberObj?.users[0] : memberObj?.users;
          const name = userObj?.full_name || memberObj?.full_name || casualObj?.full_name || p.full_name || 'Rider';
          const avatarUrl = userObj?.avatar_url || null;
          riderNames.push(name);
          riderInitials.push({ 
            init: name.substring(0, 2).toUpperCase(), 
            name, 
            id: p.id,
            attendanceStatus: p.attendance_records?.[0]?.status || 'NOT_CHECKED_IN',
            avatarUrl,
            horseId: p.horse_id || null,
            horseName: p.horses?.name || null
          });
        }
      }
      
      if (isToday) {
        totalSessions++;
        totalCapacity += slot.capacity;
        totalRiders += slotRiders;
      }
      
      // Determine if session is current or upcoming based on time
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);
      const [year, month, day] = slot.slot_date.split('-').map(Number);
      
      const startTime = new Date(year, month - 1, day, startH, startM, 0, 0);
      // Riding session is 60 minutes
      const sessionDurationMs = 60 * 60000;
      const sessionEndTime = new Date(startTime.getTime() + sessionDurationMs);
      
      if (now >= startTime && now <= sessionEndTime) {
        // Current session
        const elapsedMs = now.getTime() - startTime.getTime();
        const remainMs = sessionDurationMs - elapsedMs;
        
        currentSession = {
          id: slot.id,
          timeRange: `${slot.start_time.substring(0, 5)} — ${sessionEndTime.toTimeString().substring(0, 5)}`,
          arena: 'Arena 01', // Static for now as arena not in schema
          riders: riderInitials,
          progressPercent: Math.round((elapsedMs / sessionDurationMs) * 100),
          elapsedText: `${Math.round(elapsedMs / 60000)} menit berjalan`,
          remainingText: `sisa ${Math.round(remainMs / 60000)} menit`
        };
      } else if (now < startTime) {
        // Upcoming session
        if (slotRiders > 0 && upcoming.length < 5) {
          upcoming.push({
            id: slot.id,
            time: slot.start_time.substring(0, 5),
            rawTime: `${slot.slot_date}T${slot.start_time}`,
            duration: 60, // Standardized 60 minutes
            riders: slotRiders,
            arena: 'Arena 01',
            names: riderNames.length > 0 ? riderNames.join(' · ') : 'Empty slot',
            status: slotRiders > 0 ? 'Ready' : 'Upcoming'
          });
        }
      } else if (now > sessionEndTime) {
        // Past session
        const pastSessions = []; // Not using global to avoid mutation issues, we'll build it here
      }
    }
  }

  // Find past sessions correctly
  const pastSessions: UpcomingSession[] = [];
  if (slots) {
    for (const slot of slots) {
      const isToday = slot.slot_date === today;
      if (!isToday) continue;
      
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [year, month, day] = slot.slot_date.split('-').map(Number);
      const startTime = new Date(year, month - 1, day, startH, startM, 0, 0);
      const sessionDurationMs = 60 * 60000;
      const sessionEndTime = new Date(startTime.getTime() + sessionDurationMs);
      
      if (now > sessionEndTime) {
        const validBookings = (slot.bookings as any[])?.filter(b => 
          ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'].includes(b.status)
        ) || [];
        
        let slotRiders = 0;
        const riderNames: string[] = [];
        const ridersList: Array<{
          id: string;
          name: string;
          init: string;
          avatarUrl?: string | null;
          horseId?: string | null;
          horseName?: string | null;
          attendanceStatus: string;
        }> = [];

        for (const b of validBookings) {
          const participants = b.booking_participants || [];
          slotRiders += participants.length;
          for (const p of participants) {
            const memberObj = Array.isArray(p.members) ? p.members[0] : p.members;
            const userObj = Array.isArray(memberObj?.users) ? memberObj?.users[0] : memberObj?.users;
            const name = userObj?.full_name || memberObj?.full_name || p.full_name || 'Rider';
            const avatarUrl = userObj?.avatar_url || null;
            riderNames.push(name);
            ridersList.push({
              id: p.id,
              name,
              init: name.substring(0, 2).toUpperCase(),
              avatarUrl,
              horseId: p.horse_id || null,
              horseName: p.horses?.name || null,
              attendanceStatus: p.attendance_records?.[0]?.status || 'NOT_CHECKED_IN'
            });
          }
        }
        
        if (slotRiders > 0) {
          pastSessions.push({
            id: slot.id,
            time: slot.start_time.substring(0, 5),
            rawTime: `${slot.slot_date}T${slot.start_time}`,
            duration: 60,
            riders: slotRiders,
            arena: 'Arena 01',
            names: riderNames.length > 0 ? riderNames.join(' · ') : 'Empty slot',
            status: 'Completed',
            ridersList
          });
        }
      }
    }
  }
  // Reverse pastSessions so the most recent completed is at the top
  pastSessions.reverse();

  
  const spotsLeft = totalCapacity - totalRiders;

  const pending: PendingRequestSummary = {
    booking: pendingBookingsCount || 0,
    reschedule: pendingRescheduleCount || 0,
    membership: membershipReqCount || 0,
    riding: ridingReqCount || 0,
    total: (pendingBookingsCount || 0) + (pendingRescheduleCount || 0) + (membershipReqCount || 0) + (ridingReqCount || 0)
  };

  
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);
  // The query for expiringMemberships was moved to the initial Promise.all
  // and we access it via the destructured expiringRes object
  const expiringMemberships = expiringRes.data;
    
  const followUps = [];
  
  if (expiringMemberships) {
    for (const m of expiringMemberships) {
      const name = (m.members as any)?.users?.full_name || 'Member';
      const pkg = (m.packages as any)?.name || 'Paket';
      const daysLeft = Math.ceil((new Date(m.end_date).getTime() - now.getTime()) / (1000 * 3600 * 24));
      
      followUps.push({
        id: m.id,
        type: 'membership',
        title: `${name} · membership habis ${daysLeft} hari lagi`,
        subtitle: `${pkg} · sisa 0 sesi · ${m.end_date}`, // mocking sisa sesi for now
        actionText: 'Ingatkan',
        icon: 'Hourglass'
      });
    }
  }
  
  // Add mock follow up for empty slots tomorrow
  followUps.push({
    id: 'empty-slot',
    type: 'slot',
    title: 'Besok 07:00 & 08:00 masih kosong',
    subtitle: 'Kirim info slot ke member aktif?',
    actionText: 'Kirim info',
    icon: 'Calendar'
  });

  const alerts: OperationalAlert[] = []; // kept for backward compatibility

  return {
    stats: { sessions: totalSessions, riders: totalRiders, spotsLeft },
    pending,
    pendingBookingsList: pendingBookingsList || [],
    upcoming,
    currentSession,
    pastSessions,
    followUps,
    alerts
  };
}

