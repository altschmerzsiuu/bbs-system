"use client";
import React, { useState } from 'react';
import { Search, Plus, ChevronLeft, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminMembersClient({ members }: { members: any[] }) {
  const [activeChip, setActiveChip] = useState('Semua');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const router = useRouter();

  const filteredMembers = members.filter(m => {
    const matchSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || (m.phone || '').includes(search);
    if (!matchSearch) return false;
    const activeMembership = m.memberships?.find((ms: any) => ms.status === 'ACTIVE');
    const planName = activeMembership?.membership_plans?.name || '';
    if (activeChip === 'Gold' && !planName.toLowerCase().includes('gold')) return false;
    if (activeChip === 'Silver' && !planName.toLowerCase().includes('silver')) return false;
    return true;
  });

  return (
    <section className="screen active" data-page="members">
      {/* Appbar */}
      <div className="appbar" style={{ paddingBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => router.back()}
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', background: '#fff', color: 'var(--ink)', cursor: 'pointer' }}
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>Member</span>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{members.length} member terdaftar</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', background: '#FFF', borderRadius: '24px', padding: '0 16px', height: '48px', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', marginBottom: '16px' }}>
        <Search size={18} color="var(--muted)" style={{ marginRight: '10px', flexShrink: 0 }} />
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
            className={`chip ${activeChip === chip ? 'active' : ''}`}
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
          const planName = activeMembership?.membership_plans?.name || 'Basic';
          const initials = m.full_name.substring(0, 2).toUpperCase();
          const isGold = planName.toLowerCase().includes('gold');
          const isSilver = planName.toLowerCase().includes('silver');

          return (
            <div key={m.id} className="row" onClick={() => router.push(`/admin/members/${m.id}`)}>
              <div className="avatar">{initials}</div>
              <div className="rowmain">
                <b>{m.full_name}</b>
                <span>{m.phone || '—'}</span>
              </div>
              {isGold ? (
                <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: '#fffcf0', color: '#b47b09', border: '1px solid #fce8a4', flexShrink: 0 }}>✦ Gold</span>
              ) : isSilver ? (
                <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, background: '#f0f4f8', color: '#475569', border: '1px solid #cbd5e1', flexShrink: 0 }}>◆ Silver</span>
              ) : (
                <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: 'rgba(0,0,0,0.05)', color: 'var(--muted)', flexShrink: 0 }}>Basic</span>
              )}
            </div>
          );
        })}
        {filteredMembers.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            Tidak ada member ditemukan.
          </div>
        )}
      </div>
      <div style={{ height: '100px' }} />

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); router.refresh(); }}
        />
      )}
    </section>
  );
}

// ─── Add Member Modal ──────────────────────────────────────────────────────

function AddMemberModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Nama lengkap wajib diisi.'); return; }
    if (!phone.trim()) { setError('Nomor WhatsApp wajib diisi.'); return; }
    setError('');
    setLoading(true);
    try {
      const { addMemberAction } = await import('./actions');
      const res = await addMemberAction({
        fullName: fullName.trim(),
        phone: phone.trim(),
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError(res.message || 'Gagal menambahkan member.');
      }
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
    >
      <div style={{ background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '28px 24px', paddingBottom: 'max(env(safe-area-inset-bottom, 24px), 32px)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Tambah Member</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>Tambah member secara manual</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: '8px', background: '#F5F5F5', borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Full Name */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nama Lengkap <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              disabled={loading}
              autoFocus
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '15px', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box', font: 'inherit' }}
            />
          </div>

          {/* Phone */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nomor WhatsApp <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Contoh: 08123456789"
              type="tel"
              disabled={loading}
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '15px', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box', font: 'inherit' }}
            />
          </div>

          {/* Emergency Contact divider */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Kontak Darurat <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opsional)</span>
            </p>
          </div>

          <input
            value={emergencyName}
            onChange={e => setEmergencyName(e.target.value)}
            placeholder="Nama kontak darurat"
            disabled={loading}
            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '15px', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box', font: 'inherit' }}
          />

          <input
            value={emergencyPhone}
            onChange={e => setEmergencyPhone(e.target.value)}
            placeholder="Nomor kontak darurat"
            type="tel"
            disabled={loading}
            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '15px', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box', font: 'inherit' }}
          />

          {/* Error */}
          {error && (
            <div style={{ padding: '12px 16px', background: '#FEF2F2', borderRadius: '12px', color: '#DC2626', fontSize: '13px', fontWeight: 500 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '16px', borderRadius: '16px',
              background: loading ? 'rgba(0,0,0,0.08)' : 'var(--ink)',
              color: loading ? 'var(--muted)' : '#fff',
              fontSize: '15px', fontWeight: 700, border: 'none',
              cursor: loading ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            {loading && <Loader2 size={18} className="spin" />}
            {loading ? 'Menyimpan...' : 'Tambah Member'}
          </button>
        </form>
      </div>
    </div>
  );
}
