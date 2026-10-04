import React from 'react';
import { requireActor } from '@/lib/auth';
import { createServerClient } from '@/infrastructure/supabase-server';
import AdminReportsClient from './AdminReportsClient';

export const dynamic = 'force-dynamic';

async function getReportData(db: Awaited<ReturnType<typeof createServerClient>>) {
  const now = new Date();
  
  // Current week range (Mon–Sun)
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Current month range
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const toDate = (d: Date) => d.toISOString().split('T')[0];

  const [
    { data: monthSlots },
    { count: totalMembers },
    { count: totalHorses },
    { data: horseUsage }
  ] = await Promise.all([
    // Fetch session slots for the current month
    db.from('riding_slots')
      .select(`
        id,
        date,
        start_time,
        end_time,
        is_open,
        booking_participants (
          id,
          attendance_records ( status ),
          bookings ( status )
        )
      `)
      .gte('date', toDate(monthStart))
      .lt('date', toDate(monthEnd))
      .order('date', { ascending: true }),
      
    // Fetch total members count
    db.from('members')
      .select('id', { count: 'exact', head: true }),
      
    // Fetch active horses count
    db.from('horses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE'),
      
    // Fetch horse usage this month
    db.from('booking_participants')
      .select(`
        horse_id,
        horses ( name ),
        bookings ( riding_slots ( date ) )
      `)
      .not('horse_id', 'is', null)
      .filter('bookings.riding_slots.date', 'gte', toDate(monthStart))
      .filter('bookings.riding_slots.date', 'lt', toDate(monthEnd))
  ]);

  const slots = monthSlots || [];
  const weekSlots = slots.filter(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d >= weekStart && d < weekEnd;
  });

  const computeStats = (slotList: typeof slots) => {
    let total = 0, attended = 0, noShow = 0, cancelled = 0;
    for (const slot of slotList) {
      const participants = slot.booking_participants || [];
      for (const p of participants) {
        const bookingStatus = (Array.isArray(p.bookings) ? p.bookings[0] : p.bookings)?.status;
        if (bookingStatus === 'MEMBER_CANCELLED' || bookingStatus === 'BBS_CANCELLED') { cancelled++; continue; }
        total++;
        const aStatus = p.attendance_records?.[0]?.status;
        if (aStatus === 'ATTENDED') attended++;
        else if (aStatus === 'NO_SHOW') noShow++;
      }
    }
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { total, attended, noShow, cancelled, attendanceRate };
  };

  const weekStats = computeStats(weekSlots);
  const monthStats = computeStats(slots);

  // Horse usage count this month
  const horseCountMap: Record<string, { name: string; count: number }> = {};
  (horseUsage || []).forEach((p: any) => {
    if (!p.horse_id) return;
    const slotDate = (Array.isArray(p.bookings) ? p.bookings[0] : p.bookings)?.riding_slots?.date;
    if (!slotDate) return;
    const d = new Date(slotDate + 'T00:00:00');
    if (d < monthStart || d >= monthEnd) return;
    if (!horseCountMap[p.horse_id]) {
      const horseName = (Array.isArray(p.horses) ? p.horses[0] : p.horses)?.name || 'Unknown';
      horseCountMap[p.horse_id] = { name: horseName, count: 0 };
    }
    horseCountMap[p.horse_id].count++;
  });

  const topHorse = Object.values(horseCountMap).sort((a, b) => b.count - a.count)[0];

  // Weekly breakdown for bar chart (last 4 weeks of the current month)
  const weekBreakdown = [0, 1, 2, 3].map(i => {
    const wStart = new Date(monthStart);
    wStart.setDate(monthStart.getDate() + i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 7);
    const count = slots.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= wStart && d < wEnd;
    }).reduce((acc, s) => {
      const participants = (s.booking_participants || []).filter((p: any) => {
        const bs = (Array.isArray(p.bookings) ? p.bookings[0] : p.bookings)?.status;
        return bs !== 'MEMBER_CANCELLED' && bs !== 'BBS_CANCELLED';
      });
      return acc + participants.length;
    }, 0);
    return { label: `M${i + 1}`, count };
  });

  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const weekLabel = `${weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return {
    weekStats,
    monthStats,
    totalMembers: totalMembers || 0,
    totalHorses: totalHorses || 0,
    topHorse: topHorse || null,
    weekBreakdown,
    monthLabel,
    weekLabel,
  };
}

export default async function AdminReportsPage() {
  await requireActor(['ADMIN']);
  const db = await createServerClient();
  const reportData = await getReportData(db);

  return <AdminReportsClient data={reportData} />;
}
