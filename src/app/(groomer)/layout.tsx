import { requireActor } from '@/lib/auth';

export default async function GroomerLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor(['GROOMER', 'ADMIN']);
  
  return (
    <div className="shell">
      <div className="phone role-groomer">
        <div className="viewport">
          {children}
        </div>
      </div>
    </div>
  );
}
