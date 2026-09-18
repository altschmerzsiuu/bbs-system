import { requireActor } from '@/lib/auth';
import BottomNavAdmin from '@/components/admin/bottom-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['ADMIN']);
  
  return (
    <div className="shell">
      <div className="phone role-admin">
        <div className="viewport">
          {children}
        </div>
        <BottomNavAdmin />
      </div>
    </div>
  );
}
