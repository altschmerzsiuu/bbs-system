import Link from 'next/link';
import { Home, QrCode } from 'lucide-react';
import { requireActor } from '@/lib/auth';

export default async function GroomerLayout({ children }: { children: React.ReactNode }) {
  await requireActor(['GROOMER', 'ADMIN']);

  return (
    <div className="role-groomer" style={{ maxWidth: '480px', margin: '0 auto', paddingBottom: '100px' }}>
      {children}

      {/* Groomer Bottom Nav with Protruding Center Scan QR Button */}
      <nav
        style={{
          position: 'fixed',
          zIndex: 35,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: '456px',
          bottom: '12px',
          height: '68px',
          borderRadius: '26px',
          background: 'rgba(22, 22, 24, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 12px',
        }}
      >
        <Link
          href="/groomer"
          style={{
            flex: 1,
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Home size={19} strokeWidth={1.9} color="#b9974f" />
          <span style={{ fontSize: '9.5px', fontWeight: 700 }}>Jadwal Hari Ini</span>
        </Link>

        <Link
          href="/checkin"
          style={{
            position: 'relative',
            flex: '0 0 84px',
            height: '68px',
            padding: '0 0 10px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            textDecoration: 'none',
            overflow: 'visible',
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-28px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #d7b56d 0%, #b9974f 55%, #8f6f2a 100%)',
              border: '5px solid var(--paper, #f7f6f1)',
              boxShadow: '0 10px 24px rgba(24, 24, 23, 0.35), 0 0 0 1px rgba(185, 151, 79, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#181817',
            }}
          >
            <QrCode size={27} strokeWidth={2.3} color="#181817" />
          </div>
          <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#f3e6c6', letterSpacing: '0.3px', lineHeight: 1 }}>
            Scan QR
          </span>
        </Link>

        <div style={{ flex: 1 }} />
      </nav>
    </div>
  );
}
