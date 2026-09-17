'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/schedule', label: 'Schedule', icon: '📅' },
  { href: '/bookings', label: 'Rides', icon: '🐎' },
  { href: '/membership', label: 'Plan', icon: '💳' },
  { href: '/profile', label: 'Profile', icon: '👤' },
];

export function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <button className={isActive ? 'on' : ''}>
              <span className="text-lg">{item.icon}</span>
            </button>
          </Link>
        );
      })}
    </nav>
  );
}
