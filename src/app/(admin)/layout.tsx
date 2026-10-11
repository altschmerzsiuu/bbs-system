import { requireActor } from '@/lib/auth';
import BottomNavAdmin from '@/components/admin/bottom-nav';
import { FCMRegistrar } from '@/modules/notifications/components/fcm-registrar';
import './admin.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['ADMIN']);
  
  return (
    <div className="role-admin" style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '80px', minHeight: '100vh' }}>
      <FCMRegistrar />
      {children}
      <BottomNavAdmin />
    </div>
  );
}

