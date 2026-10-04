export default function Loading() {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 0' }}>
        <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
        <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      </div>
      <div style={{ padding: '12px 24px 20px' }}>
        <div className="skel" style={{ width: '160px', height: '44px', marginBottom: '6px' }} />
        <div className="skel" style={{ width: '120px', height: '16px', borderRadius: '6px' }} />
      </div>
      {/* Date strip */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 24px 20px', overflowX: 'hidden' }}>
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="skel" style={{ width: '52px', height: '72px', borderRadius: '16px', flexShrink: 0 }} />
        ))}
      </div>
      {/* Slot cards */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skel" style={{ width: '100%', height: '80px', borderRadius: '20px' }} />
        ))}
      </div>
    </div>
  );
}
