export default function Loading() {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh', padding: '0' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 12px' }}>
        <div className="skel" style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
        <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      </div>
      {/* Greeting */}
      <div style={{ padding: '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="skel" style={{ width: '140px', height: '28px' }} />
        <div className="skel" style={{ width: '220px', height: '52px' }} />
        <div className="skel" style={{ width: '130px', height: '22px', borderRadius: '100px' }} />
      </div>
      {/* Next ride card */}
      <div style={{ padding: '0 24px' }}>
        <div className="skel" style={{ width: '100%', height: '200px', borderRadius: '24px' }} />
      </div>
      {/* Quick grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', padding: '24px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="skel" style={{ width: '72px', height: '72px', borderRadius: '24px' }} />
            <div className="skel" style={{ width: '60px', height: '14px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
      {/* Quote banner */}
      <div style={{ padding: '0 24px' }}>
        <div className="skel" style={{ width: '100%', height: '160px', borderRadius: '24px' }} />
      </div>
    </div>
  );
}
