import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default async function RequestSuccessPage(props: {
  searchParams: Promise<{ id?: string; type?: string }>;
}) {
  const searchParams = await props.searchParams;
  const isMembership = searchParams.type === 'MEMBERSHIP_APPLICATION';
  const displayId = searchParams.id || 'BBS-REQ-XXX';

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f4fbf7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <CheckCircle2 size={40} color="#128C7E" />
      </div>

      <h1 style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--ink)', textAlign: 'center', marginBottom: '8px', lineHeight: 1.2 }}>
        Request Submitted
      </h1>
      
      <p style={{ fontSize: '15px', color: 'var(--muted)', textAlign: 'center', marginBottom: '32px', maxWidth: '300px', lineHeight: 1.5, fontFamily: 'var(--font-sans)' }}>
        Your {isMembership ? 'membership application' : 'riding request'} has been successfully received by our Admin.
      </p>

      <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Link 
          href="/home" 
          style={{ 
            width: '100%', height: '56px', background: 'var(--ink)', color: 'var(--white)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 600, fontSize: '16px', textDecoration: 'none'
          }}
        >
          Back to Home
        </Link>
        <a 
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_ADMIN_NUMBER}?text=${encodeURIComponent(`Halo Admin BBS, saya baru saja melakukan permohonan ${isMembership ? 'Membership' : 'Casual Ride'}. Mohon konfirmasinya ya!`)}`} 
          target="_blank" rel="noopener noreferrer"
          style={{ 
            width: '100%', height: '56px', background: 'var(--white)', color: 'var(--ink)', border: '1px solid #e0dfda',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontWeight: 600, fontSize: '15px', textDecoration: 'none'
          }}
        >
          Contact Admin via WhatsApp
        </a>
      </div>

    </div>
  );
}
