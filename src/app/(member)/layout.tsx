import { BottomNav } from '@/components/member/bottom-nav';
import { requireActor } from '@/lib/auth';

/**
 * Semua route di grup ini butuh sesi. Role diturunkan server-side —
 * nav tidak pernah jadi mekanisme keamanan (Section 45).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['MEMBER']);
  return (
    <div className="mx-auto min-h-dvh max-w-app px-5 pt-6 pb-nav">
      {children}
      <BottomNav role={actor.role} />
    </div>
  );
}
