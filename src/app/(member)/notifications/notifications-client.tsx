'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, Clock, ClipboardList, Crown, Megaphone, HeartPulse, Calendar, CreditCard, ChevronLeft } from 'lucide-react';

function getIconForType(title: string, type: string) {
  const t = (title + ' ' + type).toLowerCase();
  if (t.includes('booking')) return <Clock size={20} strokeWidth={2} />;
  if (t.includes('task') || t.includes('groom')) return <ClipboardList size={20} strokeWidth={2} />;
  if (t.includes('member') || t.includes('gold')) return <Crown size={20} strokeWidth={2} />;
  if (t.includes('promo')) return <Megaphone size={20} strokeWidth={2} />;
  if (t.includes('health') || t.includes('vet')) return <HeartPulse size={20} strokeWidth={2} />;
  if (t.includes('schedule')) return <Calendar size={20} strokeWidth={2} />;
  if (t.includes('payment')) return <CreditCard size={20} strokeWidth={2} />;
  return <Bell size={20} strokeWidth={2} />;
}

function getCardStyle(title: string, type: string, isRead: boolean) {
  const t = (title + ' ' + type).toLowerCase();
  
  // Base style for read
  let background = '#ffffff';
  let border = '1px solid #efeade';
  let iconBg = '#f4f2eb';
  let iconColor = 'var(--ink)';

  if (!isRead) {
    if (t.includes('booking')) {
      background = '#fdf9f1';
      border = '1px solid #ebd2a4';
      iconBg = '#f6ebd4';
      iconColor = '#a88132';
    } else if (t.includes('member')) {
      background = '#fff5f5';
      border = '1px solid #ffebeb';
      iconBg = '#ffebeb';
      iconColor = '#c06c64';
    } else {
      background = '#ffffff';
      border = '1px solid #efeade';
      iconBg = '#f4f2eb';
      iconColor = 'var(--ink)';
    }
  }

  return { background, border, iconBg, iconColor };
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return '1 day ago';
  
  const d = new Date(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function groupNotifications(list: any[]) {
  const today: any[] = [];
  const thisWeek: any[] = [];
  const earlier: any[] = [];
  
  const now = Date.now();
  
  list.forEach(n => {
    const d = new Date(n.created_at).getTime();
    const diffDays = (now - d) / 86_400_000;
    if (diffDays < 1) today.push(n);
    else if (diffDays < 7) thisWeek.push(n);
    else earlier.push(n);
  });
  
  return { today, thisWeek, earlier };
}

export function NotificationsClient({ initialData }: { initialData: any[] }) {
  const [filter, setFilter] = useState('All');
  
  const filteredData = initialData.filter(n => {
    if (filter === 'All') return true;
    const t = (n.title + ' ' + n.event_type).toLowerCase();
    if (filter === 'Bookings') return t.includes('booking');
    if (filter === 'Tasks') return t.includes('task');
    if (filter === 'Updates') return !t.includes('booking') && !t.includes('task');
    return true;
  });

  const { today, thisWeek, earlier } = groupNotifications(filteredData);
  
  const filters = ['All', 'Bookings', 'Tasks', 'Updates'];

  const renderList = (title: string, list: any[]) => {
    if (list.length === 0) return null;
    return (
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>{title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {list.map(n => {
            const isRead = !!n.read_at;
            const { background, border, iconBg, iconColor } = getCardStyle(n.title, n.event_type || '', isRead);
            
            return (
              <div key={n.id} style={{ 
                background, 
                border,
                borderRadius: '20px', 
                padding: '20px', 
                display: 'flex', 
                gap: '16px',
                position: 'relative'
              }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
                  {getIconForType(n.title, n.event_type || '')}
                </div>
                
                <div style={{ flex: 1, paddingRight: '64px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                    {n.title || 'System Update'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {n.body || ''}
                  </div>
                </div>
                
                {/* Top Right Info */}
                <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>{timeAgo(n.created_at)}</span>
                  {!isRead && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c19c5c' }} />
                  )}
                </div>
                
                {/* Bottom Right Chevron */}
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', color: 'var(--muted)', opacity: 0.7 }}>
                  <ChevronRight size={20} strokeWidth={2} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f5', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Top App Bar ── */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/home">
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', color: 'var(--ink)' }}>
            <ChevronLeft size={22} strokeWidth={2} />
          </div>
        </Link>
        <div style={{ width: '44px' }}></div> {/* Spacer */}
      </div>

      <div style={{ padding: '0 24px', marginBottom: '24px' }}>
        <h1 style={{ font: '40px/1.1 var(--font-display)', margin: '0 0 8px 0', color: 'var(--ink)' }}>Notifications</h1>
        <p style={{ fontSize: '15px', color: 'var(--muted)', margin: 0 }}>Stay updated with what matters.</p>
      </div>

      {/* ── Filters ── */}
      <div style={{ padding: '0 24px', marginBottom: '32px', display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {filters.map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            style={{ 
              padding: '10px 20px', 
              borderRadius: '100px', 
              background: filter === f ? 'var(--ink)' : '#f4f2eb', 
              color: filter === f ? '#fff' : 'var(--ink)', 
              border: 'none', 
              fontSize: '14px', 
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Lists ── */}
      <div style={{ padding: '0 24px', flex: 1, paddingBottom: '40px' }}>
        {filteredData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '40px' }}>No notifications found.</div>
        ) : (
          <>
            {renderList('Today', today)}
            {renderList('This Week', thisWeek)}
            {renderList('Earlier', earlier)}
          </>
        )}
      </div>
    </div>
  );
}
