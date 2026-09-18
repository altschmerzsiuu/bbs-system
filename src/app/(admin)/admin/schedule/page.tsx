import React from 'react';
import Link from 'next/link';
import { requireActor } from '@/lib/auth';
import { ChevronLeft } from 'lucide-react';

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default async function AdminSchedulePage(props: { searchParams: Promise<{ filter?: string, date?: string }> }) {
  await requireActor(['ADMIN']);
  const searchParams = await props.searchParams;
  const filter = searchParams.filter || 'today';
  
  const todayDate = new Date();
  const selectedDate = searchParams.date || todayDate.toISOString().slice(0, 10);
  
  // Mock generating 7 days
  const availableDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const slots = [
    { time: '07:00', riders: 2, desc: 'Arena 01', status: 'Open' },
    { time: '08:00', riders: 1, desc: 'Arena 01', status: 'Open' },
    { time: '09:00', riders: 1, desc: 'Arena 01', status: 'Open', highlight: true },
    { time: '10:00', riders: 0, desc: 'Closed · horse care', status: 'Closed' },
    { time: '13:00', riders: 1, desc: 'Arena 01', status: 'Open' },
    { time: '14:00', riders: 1, desc: 'Arena 01', status: 'Open' },
    { time: '15:00', riders: 2, desc: 'Arena 01', status: 'Open' },
    { time: '16:00', riders: 1, desc: 'Arena 01', status: 'Open' },
    { time: '17:00', riders: 1, desc: 'Arena 01', status: 'Open' }
  ];

  return (
    <div>
      <div className="top">
        <Link href="/admin" className="icon" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} strokeWidth={2} color="var(--ink)" />
        </Link>
        <div className="topmain">
          <h2>Today's Schedule</h2>
          <span>20 September 2026</span>
        </div>
      </div>

      <div className="filters">
        <Link href={`?filter=today&date=${selectedDate}`} className={`filter ${filter === 'today' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Today</Link>
        <Link href={`?filter=7days&date=${selectedDate}`} className={`filter ${filter === '7days' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>7 Days</Link>
        <Link href={`?filter=14days&date=${selectedDate}`} className={`filter ${filter === '14days' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>14 Days</Link>
        <Link href={`?filter=month&date=${selectedDate}`} className={`filter ${filter === 'month' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Month</Link>
      </div>

      <div className="calendar" style={{ marginBottom: '16px' }}>
        {availableDates.map(date => {
          const d = new Date(`${date}T00:00:00`);
          const isSelected = selectedDate === date;
          return (
            <Link
              href={`?filter=${filter}&date=${date}`}
              key={date}
              className={`day ${isSelected ? 'selected' : ''}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {DAYS_SHORT[d.getDay()]}
              <b>{d.getDate()}</b>
            </Link>
          );
        })}
      </div>

      <div className="list">
        {slots.map((s, i) => (
          <Link href={`/admin/schedule/${i}`} key={i} className={`slot ${s.status === 'Closed' ? 'full' : ''}`} style={{ textDecoration: 'none' }}>
            <div className="slottime">{s.time}</div>
            <div className="slotmain">
              {s.status === 'Open' ? (
                <>
                  <b>{s.riders} rider{s.riders !== 1 ? 's' : ''}</b>
                  <span>
                    {s.highlight ? <span style={{ background: '#bfe3fc', padding: '0 4px', color: '#135c91' }}>{s.desc}</span> : s.desc}
                  </span>
                </>
              ) : (
                <span>{s.desc}</span>
              )}
            </div>
            <span className={`pill ${s.status === 'Open' ? 'ok' : ''}`} style={s.status === 'Closed' ? { background: '#faeae9', color: '#c06c64' } : {}}>
              {s.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
