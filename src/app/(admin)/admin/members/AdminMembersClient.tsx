"use client";
import React, { useState } from 'react';
import { Search, Plus, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminMembersClient({ members }: { members: any[] }) {
  const [activeChip, setActiveChip] = useState('Semua');
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filteredMembers = members.filter(m => {
      const matchSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
      if (!matchSearch) return false;

      const activeMembership = m.memberships?.find((ms: any) => ms.status === 'ACTIVE');
      const planName = activeMembership?.membership_plans?.name || '';
      
      if (activeChip.includes('Gold') && !planName.toLowerCase().includes('gold')) return false;
      if (activeChip.includes('Silver') && !planName.toLowerCase().includes('silver')) return false;
      
      return true;
  });

  return (
    <section className="screen active" data-page="members">
      {/* 1. Appbar */}
      <div className="appbar" style={{ paddingBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: 'var(--ink)' }}>
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>Member</span>
        <button style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer' }} onClick={() => alert('Add Member Form')}>
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{members.length} member terdaftar</span>
      </div>

      <div className="search" style={{ display: 'flex', alignItems: 'center', background: '#FFF', borderRadius: '24px', padding: '0 16px', height: '48px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', marginBottom: '16px' }}>
        <Search size={18} color="var(--muted)" style={{ marginRight: '10px' }} />
        <input 
          placeholder="Cari nama atau nomor WhatsApp" 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: '14px', font: 'inherit' }}
        />
      </div>

      <div className="chips" data-chipgroup style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch', marginBottom: '8px' }}>
        {['Semua', 'Gold', 'Silver'].map(chip => (
          <button 
            key={chip} 
            className={`chip ${activeChip.split(' ')[0] === chip.split(' ')[0] ? 'active' : ''}`}
            onClick={() => setActiveChip(chip)}
            style={{ whiteSpace: 'nowrap', padding: '6px 14px', fontSize: '13px', borderRadius: '14px' }}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="rowlist">
        {filteredMembers.map((m: any) => {
            const activeMembership = m.memberships?.find((ms: any) => ms.status === 'ACTIVE');
            const planName = activeMembership?.membership_plans?.name || 'Basic Member';
            const initials = m.full_name.substring(0, 2).toUpperCase();
            return (
                <div key={m.id} className="row" onClick={() => router.push(`/admin/members/${m.id}`)}>
                    <div className="avatar">{initials}</div>
                    <div className="rowmain">
                      <b>{m.full_name}</b>
                      <span>{planName}</span>
                    </div>
                    {(() => {
                      if (planName.toLowerCase().includes('gold')) {
                        return <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: '#fffcf0', color: '#b47b09', border: '1px solid #fce8a4' }}>Gold</span>;
                      } else if (planName.toLowerCase().includes('silver')) {
                        return <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: '#f8f9fa', color: '#64748b', border: '1px solid #e2e8f0' }}>Silver</span>;
                      } else {
                        return <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>Basic</span>;
                      }
                    })()}
                </div>
            )
        })}
      </div>
      <div style={{ height: '100px' }} />
    </section>
  );
}
