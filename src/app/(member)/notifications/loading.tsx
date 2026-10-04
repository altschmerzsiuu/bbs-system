export default function Loading() {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px' }}>
        <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
        <div className="skel" style={{ width: '160px', height: '28px' }} />
      </div>
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="skel" style={{ width: '100%', height: '72px', borderRadius: '16px' }} />
        ))}
      </div>
    </div>
  );
}
