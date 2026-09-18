import { requireActor } from '@/lib/auth';
import BottomNavAdmin from '@/components/admin/bottom-nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['ADMIN']);
  
  return (
    <>
      <div className="mx-auto min-h-dvh max-w-app px-5 pt-6 pb-nav">
        {children}
      </div>
      <BottomNavAdmin />
    </>
  );
}
