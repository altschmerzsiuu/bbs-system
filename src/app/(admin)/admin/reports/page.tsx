import React from 'react';
import { requireActor } from '@/lib/auth';

export default async function AdminReportsPage() {
  await requireActor(['ADMIN']);

  const heights = [38, 52, 44, 70];

  return (
    <div>
      <div className="top">
        <div className="topmain">
          <h2>Reports</h2>
          <span>September 2026 (Mock)</span>
        </div>
      </div>

      <div className="adminHero">
        <span className="eyebrow" style={{ color: '#d8c18a' }}>TOTAL SESSIONS</span>
        <div className="big">126 sessions</div>
        <div style={{ fontSize: '8px', color: '#aaa' }}>
          112 completed · 8 cancelled · 6 no-show
        </div>
      </div>

      <div className="statStrip" style={{ marginTop: '14px' }}>
        <div className="stat">
          <strong>89%</strong>
          <span>Attendance</span>
        </div>
        <div className="stat">
          <strong>74%</strong>
          <span>Utilisation</span>
        </div>
        <div className="stat">
          <strong>Rp42jt</strong>
          <span>Revenue</span>
          <em className="up">▲ +12%</em>
        </div>
      </div>

      <div className="section">
        <b>Monthly trend</b>
        <span className="sub">Last 4 weeks</span>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px', padding: '14px 18px' }}>
        {heights.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--accentSoft)', borderRadius: '5px 5px 0 0', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '5px 5px 0 0', background: 'var(--accent)', opacity: 0.85 }}></div>
          </div>
        ))}
      </div>

      <button className="primary" style={{ marginTop: '14px' }}>Export report</button>
    </div>
  );
}
