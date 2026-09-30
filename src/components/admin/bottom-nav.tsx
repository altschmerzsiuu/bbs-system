'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Users, BarChart2 } from 'lucide-react';

export default function BottomNavAdmin() {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', Icon: Home, label: 'Beranda' },
    { href: '/admin/schedule', Icon: Calendar, label: 'Jadwal' },
    { href: '/admin/members', Icon: Users, label: 'Member' },
    { href: '/admin/reports', Icon: BarChart2, label: 'Laporan' },
  ];

  return (
    <nav className="admin-nav">
      {navItems.map(({ href, label, Icon }) => {
        // Only active for exact /admin match or sub-paths for other routes
        const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        
        return (
          <Link
            key={href}
            href={href}
            className={isActive ? 'active' : ''}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
