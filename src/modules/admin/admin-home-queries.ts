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
}

export interface CurrentSession {
  id: string;
  timeRange: string;
  arena: string;
  riders: Array<{ init: string; name: string; id: string; attendanceStatus: string }>;
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
    { count: ridingReqCount },
    expiringRes
  ] = await Promise.all([
    db.from('session_slots')
      .select(`
        id, slot_date, start_time, end_time, capacity,
        bookings!bookings_slot_id_fkey(id, status, booking_participants(id, participant_status, attendance_records(status), member_id, members(user_id, users(full_name))))
      `)
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true }),
      
    db.from('membership_applications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_REVIEW'),
    
    db.from('riding_requests').select('*', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
    
    // 4. Fetch expiring memberships for alerts
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
  
  const now = new Date();
  let currentSession: CurrentSession | null = null;
  
  if (slots) {
    for (const slot of slots) {
      const isToday = slot.slot_date === today;
      
      let slotRiders = 0;
      const riderNames: string[] = [];
      const riderInitials: Array<{ init: string; name: string; id: string; attendanceStatus: string }> = [];
      
      const validBookings = (slot.bookings as any[])?.filter(b => 
        ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'].includes(b.status)
      ) || [];
      for (const b of validBookings) {
        const participants = b.booking_participants || [];
        slotRiders += participants.length;
        
        for (const p of participants) {
          const name = p.members?.users?.full_name || p.full_name || 'Rider';
          riderNames.push(name);
          riderInitials.push({ 
            init: name.substring(0, 2).toUpperCase(), 
            name, 
            id: p.id,
            attendanceStatus: p.attendance_records?.[0]?.status || 'NOT_CHECKED_IN'
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
      // Hardcode business logic: a riding session is exactly 45 minutes
      const sessionDurationMs = 45 * 60000;
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
            duration: 45, // Riding sessions are always 45 minutes by business rule
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
      const sessionDurationMs = 45 * 60000;
      const sessionEndTime = new Date(startTime.getTime() + sessionDurationMs);
      
      if (now > sessionEndTime) {
        const validBookings = (slot.bookings as any[])?.filter(b => 
          ['CONFIRMED', 'PENDING', 'COMPLETED', 'NO_SHOW'].includes(b.status)
        ) || [];
        
        let slotRiders = 0;
        const riderNames: string[] = [];
        for (const b of validBookings) {
          const participants = b.booking_participants || [];
          slotRiders += participants.length;
          for (const p of participants) {
            riderNames.push(p.members?.users?.full_name || p.full_name || 'Rider');
          }
        }
        
        if (slotRiders > 0) {
          pastSessions.push({
            id: slot.id,
            time: slot.start_time.substring(0, 5),
            rawTime: `${slot.slot_date}T${slot.start_time}`,
            duration: 45,
            riders: slotRiders,
            arena: 'Arena 01',
            names: riderNames.length > 0 ? riderNames.join(' · ') : 'Empty slot',
            status: 'Completed'
          });
        }
      }
    }
  }
  // Reverse pastSessions so the most recent completed is at the top
  pastSessions.reverse();

  
  const spotsLeft = totalCapacity - totalRiders;

  const pending: PendingRequestSummary = {
    booking: ridingReqCount || 0,
    reschedule: 0, // Mocked for now as per instructions
    membership: membershipReqCount || 0,
    total: (ridingReqCount || 0) + (membershipReqCount || 0)
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
    upcoming,
    currentSession,
    pastSessions,
    followUps,
    alerts
  };
}
