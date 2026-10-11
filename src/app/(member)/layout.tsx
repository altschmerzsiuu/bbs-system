import { requireActor } from '@/lib/auth';
import { FCMRegistrar } from '@/modules/notifications/components/fcm-registrar';

/**
 * Semua route di grup ini butuh sesi. Role diturunkan server-side —
 * nav tidak pernah jadi mekanisme keamanan (Section 45).
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['MEMBER']);
  return (
    <div className="role-member" style={{ minHeight: '100vh', paddingBottom: '24px' }}>
      <FCMRegistrar />
      {children}
    </div>
  );
}

