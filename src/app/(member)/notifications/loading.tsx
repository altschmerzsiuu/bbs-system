import React from 'react';

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ width: '120px', height: '32px', background: '#efeade', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }} />
        <div style={{ width: '40px', height: '40px', background: '#efeade', borderRadius: '50%', animation: 'pulse 1.5s infinite ease-in-out' }} />
      </div>
      
      <div style={{ width: '60%', height: '48px', background: '#efeade', borderRadius: '12px', animation: 'pulse 1.5s infinite ease-in-out', marginBottom: '8px' }} />
      <div style={{ width: '40%', height: '24px', background: '#efeade', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out', marginBottom: '24px' }} />
      
      <div style={{ width: '100%', height: '180px', background: '#efeade', borderRadius: '24px', animation: 'pulse 1.5s infinite ease-in-out' }} />
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
