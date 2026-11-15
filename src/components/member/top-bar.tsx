'use client';

import Link from 'next/link';
import { Award, Bell, User } from 'lucide-react';

export function TopBar({ userName, memberTier }: { userName?: string; memberTier?: string }) {
  return (
    <div className="top">
      <div className="avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <User size={18} strokeWidth={2} color="var(--ink)" />
      </div>
      <div className="who">
        <b>Hi, {userName || 'Member'}</b>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {memberTier ? (
            <>
              <Award size={12} strokeWidth={2} color="var(--gold)" />
              <span>{memberTier}</span>
            </>
          ) : (
            'Member'
          )}
        </span>
      </div>
      <Link href="/notifications" className="bell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Bell size={18} strokeWidth={2} color="var(--ink)" />
      </Link>
    </div>
  );
}
