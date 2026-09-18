'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Ticket, Users, BarChart2 } from 'lucide-react';

export default function BottomNavAdmin() {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', Icon: Home, label: 'Home' },
    { href: '/admin/schedule', Icon: Calendar, label: 'Schedule' },
    { href: '/admin/applications', Icon: Ticket, label: 'Requests' },
    // /members and /reports are mocked as inactive for now
    { href: '/admin/members', Icon: Users, label: 'Members' },
    { href: '/admin/reports', Icon: BarChart2, label: 'Reports' },
  ];

  return (
    <nav className="nav" style={{ backgroundColor: '#252627' }}>
      {navItems.map(({ href, label, Icon }) => {
        const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
        
        return (
          <Link
            key={href}
            href={href}
            className={`navitem ${isActive ? 'active' : ''}`}
            aria-label={label}
            style={isActive ? { background: 'var(--gold)', color: '#171717' } : { color: '#a0a0a0' }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
          </Link>
        );
      })}
    </nav>
  );
}
