'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Ticket, CreditCard, User } from 'lucide-react';

const navItems = [
  { href: '/home',       label: 'Home',       Icon: Home },
  { href: '/schedule',   label: 'Book',       Icon: Calendar },
  { href: '/bookings',   label: 'Rides',      Icon: Ticket },
  { href: '/membership', label: 'Membership', Icon: CreditCard },
  { href: '/profile',    label: 'Profile',    Icon: User },
];

export function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Clear pending state when navigation finishes (pathname changes)
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const activePath = pendingPath || pathname;

  return (
    <nav className="nav">
      {navItems.map(({ href, label, Icon }) => {
        const isActive = activePath.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch={true}
            aria-label={label}
            className={isActive ? 'active' : ''}
            onClick={() => {
              if (pathname !== href) setPendingPath(href);
            }}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.2 : 1.75}
            />
          </Link>
        );
      })}
    </nav>
  );
}
