import { BottomNav } from '@/components/member/bottom-nav';
import { requireActor } from '@/lib/auth';

/**
 * Semua route di grup ini butuh sesi. Role diturunkan server-side —
 * nav tidak pernah jadi mekanisme keamanan (Section 45).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['MEMBER']);
  return (
    <div className="shell">
      <div className="phone role-member">
        <div className="viewport">
          {children}
        </div>
        <BottomNav role={actor.role} />
      </div>
    </div>
  );
}
