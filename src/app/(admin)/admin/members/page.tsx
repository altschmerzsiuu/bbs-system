import React from 'react';
import { requireActor } from '@/lib/auth';

export default async function AdminMembersPage() {
  await requireActor(['ADMIN']);

  const members = [
    { name: 'Keisha Alviani', tier: 'Gold', credits: 7 },
    { name: 'Sarah', tier: 'Silver', credits: 5 },
    { name: 'Andi Pratama', tier: 'Gold', credits: 10 },
    { name: 'Nadia Putri', tier: 'Silver', credits: 2 }
  ];

  return (
    <div>
      <div className="top">
        <div className="topmain">
          <h2>Members</h2>
          <span>8 active members (Mock)</span>
        </div>
      </div>

      <div className="filters">
        <button className="filter active">All</button>
        <button className="filter">Gold</button>
        <button className="filter">Silver</button>
      </div>

      <div className="list">
        {members.map((m, i) => (
          <div key={i} className="row">
            <div className="avatar initial">{m.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</div>
            <div className="rowmain">
              <b>{m.name}</b>
              <span>{m.tier} · {m.credits} credits</span>
            </div>
            <span className="pill ok">Active</span>
          </div>
        ))}
      </div>
    </div>
  );
}
