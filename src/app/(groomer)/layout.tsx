import { requireActor } from '@/lib/auth';

export default async function GroomerLayout({ children }: { children: React.ReactNode }) {
  await requireActor(['GROOMER', 'ADMIN']);
  
  return (
    <div className="mx-auto min-h-dvh max-w-app px-5 pt-6 pb-nav bg-gray-50">
      {children}
    </div>
  );
}
