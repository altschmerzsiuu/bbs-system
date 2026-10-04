export default function Loading() {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 24px' }}>
        <div>
          <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%', marginBottom: '16px' }} />
          <div className="skel" style={{ width: '200px', height: '44px', marginBottom: '6px' }} />
          <div className="skel" style={{ width: '130px', height: '16px', borderRadius: '6px' }} />
        </div>
      </div>
      {/* Membership card */}
      <div style={{ padding: '0 24px 20px' }}>
        <div className="skel" style={{ width: '100%', height: '220px', borderRadius: '24px' }} />
      </div>
      {/* Benefits */}
      <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skel" style={{ width: '100%', height: '52px', borderRadius: '14px' }} />
        ))}
      </div>
      {/* CTA button */}
      <div style={{ padding: '0 24px' }}>
        <div className="skel" style={{ width: '100%', height: '60px', borderRadius: '100px' }} />
      </div>
    </div>
  );
}
