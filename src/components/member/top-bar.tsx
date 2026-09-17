'use client';

import Link from 'next/link';

export function TopBar({ userName, memberTier }: { userName?: string; memberTier?: string }) {
  return (
    <div className="top">
      <div className="avatar">🧑🏻</div>
      <div className="who">
        <b>Hi, {userName || 'Member'}</b>
        <span>{memberTier ? `⚡ ${memberTier}` : 'Member'}</span>
      </div>
      <Link href="/notifications" className="bell">
        <i></i>🔔
      </Link>
    </div>
  );
}
