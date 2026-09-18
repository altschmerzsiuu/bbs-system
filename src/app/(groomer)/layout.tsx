import { requireActor } from '@/lib/auth';

export default async function GroomerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['GROOMER', 'ADMIN']);
  
  return (
    <div className="role-groomer" style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '80px' }}>
      {children}
    </div>
  );
}
