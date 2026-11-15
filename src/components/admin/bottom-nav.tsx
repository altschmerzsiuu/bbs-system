'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, BarChart2, QrCode } from 'lucide-react';

export default function BottomNavAdmin() {
  const pathname = usePathname();

  const leftItems = [
    { href: '/admin', Icon: Home, label: 'Beranda' },
    { href: '/admin/schedule', Icon: Calendar, label: 'Jadwal' },
  ];

  const rightItems = [
    { href: '/admin/members', Icon: Users, label: 'Member' },
    { href: '/admin/reports', Icon: BarChart2, label: 'Laporan' },
  ];

  const isScanActive = pathname.startsWith('/checkin');

  return (
    <nav className="admin-nav" style={{ overflow: 'visible' }}>
      {leftItems.map(({ href, label, Icon }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={isActive ? 'active' : ''}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}

      <Link
        href="/checkin"
        className={`scan-center-btn ${isScanActive ? 'active' : ''}`}
        aria-label="Scan QR Check-In"
        style={{
          position: 'relative',
          flex: '0 0 84px',
          height: '72px',
          padding: '0 0 11px 0',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          textDecoration: 'none',
          overflow: 'visible',
          zIndex: 10,
        }}
      >
        <div
          className="scan-orb"
          style={{
            position: 'absolute',
            top: '-28px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #d7b56d 0%, #b9974f 55%, #8f6f2a 100%)',
            border: '5px solid var(--paper, #f7f6f1)',
            boxShadow: '0 10px 24px rgba(24, 24, 23, 0.35), 0 0 0 1px rgba(185, 151, 79, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#181817',
          }}
        >
          <QrCode size={27} strokeWidth={2.3} color="#181817" style={{ width: '27px', height: '27px', strokeWidth: 2.3 }} />
        </div>
        <span
          style={{
            fontSize: '9.5px',
            fontWeight: 800,
            color: '#f3e6c6',
            letterSpacing: '0.3px',
            lineHeight: 1,
          }}
        >
          Scan QR
        </span>
      </Link>

      {rightItems.map(({ href, label, Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={isActive ? 'active' : ''}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
