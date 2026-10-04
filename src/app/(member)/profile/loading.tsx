export default function Loading() {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      </div>
      {/* Profile card */}
      <div style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div className="skel" style={{ width: '80px', height: '80px', borderRadius: '50%' }} />
        <div className="skel" style={{ width: '150px', height: '24px' }} />
        <div className="skel" style={{ width: '100px', height: '16px', borderRadius: '6px' }} />
      </div>
      {/* Menu items */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skel" style={{ width: '100%', height: '56px', borderRadius: '16px' }} />
        ))}
      </div>
    </div>
  );
}
