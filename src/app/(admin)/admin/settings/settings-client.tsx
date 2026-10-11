'use client';

import React, { useState } from 'react';
import { ChevronLeft, Plus, Clock, Calendar, Tag, Headphones, MessageCircle, Crown, Save, Trash2, Pencil, Check, X, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { addHorse, toggleHorseStatus, updateSiteSettings, updateAfternoonEndTime, deleteHorse, updateHorse } from './actions';
import { AlertToast } from '@/components/ui/alert-toast';
import { useRouter } from 'next/navigation';

export function SettingsClient({ initialHorses, initialSettings, initialSchedules }: { initialHorses: any[], initialSettings: any, initialSchedules: any[] }) {
  const [horses, setHorses] = useState(initialHorses);
  const [schedules, setSchedules] = useState(initialSchedules);

  const afternoonSchedule = initialSchedules.find(s => s.block === 'AFTERNOON');
  const [afternoonEndTime, setAfternoonEndTime] = useState(afternoonSchedule ? afternoonSchedule.end_time.slice(0, 5) : '18:00');
  const [newHorseName, setNewHorseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [confirmDeleteHorse, setConfirmDeleteHorse] = useState<{ id: string; name: string } | null>(null);
  const [editingHorseId, setEditingHorseId] = useState<string | null>(null);
  const [editingHorseName, setEditingHorseName] = useState('');
  const [savingHorseId, setSavingHorseId] = useState<string | null>(null);
  const [openHorseMenuId, setOpenHorseMenuId] = useState<string | null>(null);
  const router = useRouter();

  // Close dropdowns & horse menus when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
      if (!target.closest('.horse-menu-container')) {
        setOpenHorseMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Local settings state
  const [rescheduleHours, setRescheduleHours] = useState(initialSettings?.reschedule_hours?.toString() || '24');
  const [maxWeeklyBookings, setMaxWeeklyBookings] = useState(initialSettings?.max_weekly_bookings?.toString() || '2');

  const formatPrice = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    return num ? parseInt(num, 10).toLocaleString('id-ID') : '';
  };

  const [waNumber, setWaNumber] = useState(initialSettings?.admin_whatsapp || '812 3194 014');

  const handleAddHorse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHorseName.trim()) {
      toast.custom((t) => <AlertToast title="Nama kosong" description="Masukkan nama kuda terlebih dahulu sebelum menambahkan." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }
    setLoading(true);
    const res = await addHorse(newHorseName.trim());
    if (res.ok) {
      setNewHorseName('');
      toast.custom((t) => <AlertToast title="Berhasil" description="Kuda berhasil ditambahkan." onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Unknown error'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
    setLoading(false);
  };

  const handleToggleStatus = async (id: string, status: string) => {
    const newStatus = status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    // Optimistic update
    setHorses(horses.map(h => h.id === id ? { ...h, status: newStatus } : h));
    const res = await toggleHorseStatus(id, status);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description={`Status kuda diperbarui menjadi ${newStatus}.`} onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      // Revert if failed
      setHorses(horses.map(h => h.id === id ? { ...h, status: status } : h));
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Unknown error'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleStartEditHorse = (horse: { id: string; name: string }) => {
    setEditingHorseId(horse.id);
    setEditingHorseName(horse.name);
  };

  const handleSaveEditHorse = async (id: string) => {
    const trimmed = editingHorseName.trim();
    if (!trimmed) {
      toast.custom((t) => <AlertToast title="Nama kosong" description="Nama kuda tidak boleh kosong." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }
    const previousHorses = [...horses];
    // Immediate optimistic update (0ms delay)
    setHorses(horses.map(h => h.id === id ? { ...h, name: trimmed } : h));
    setEditingHorseId(null);
    setOpenHorseMenuId(null);
    toast.custom((t) => <AlertToast title="Berhasil" description="Nama kuda berhasil diperbarui." onDismiss={() => toast.dismiss(t)} />);

    const res = await updateHorse(id, trimmed);
    if (!res.ok) {
      setHorses(previousHorses);
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal mengubah nama'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    } else {
      router.refresh();
    }
  };

  const handleDeleteHorse = async (id: string, name: string) => {
    setConfirmDeleteHorse({ id, name });
  };

  const executeDeleteHorse = async () => {
    if (!confirmDeleteHorse) return;
    const { id } = confirmDeleteHorse;
    setConfirmDeleteHorse(null);

    const res = await deleteHorse(id);
    if (res.ok) {
      setHorses(horses.filter(h => h.id !== id));
      toast.custom((t) => <AlertToast title="Berhasil" description="Kuda berhasil dihapus." onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal menghapus kuda'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const payload = {
      reschedule_hours: parseInt(rescheduleHours, 10),
      admin_whatsapp: waNumber.trim(),
      max_weekly_bookings: parseInt(maxWeeklyBookings, 10)
    };
    const res = await updateSiteSettings(payload);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Pengaturan berhasil disimpan." onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Gagal menyimpan.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
    setSavingSettings(false);
  };

  return (
    <div style={{ background: '#faf8f5', minHeight: '100vh' }}>
      <div style={{ padding: '24px 24px 8px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 10, background: '#faf8f5' }}>
        <button onClick={() => window.history.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <h1 style={{ font: '24px var(--font-display)', margin: 0, color: 'var(--ink)' }}>Pengaturan Kandang</h1>
      </div>

      <div style={{ padding: '24px' }}>
        <h2 style={{ font: '24px var(--font-display)', margin: '0 0 16px', color: 'var(--ink)' }}>Manajemen Kuda</h2>

        <form onSubmit={handleAddHorse} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Nama Kuda Baru..."
            value={newHorseName}
            onChange={(e) => setNewHorseName(e.target.value)}
            style={{ flex: 1, padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', fontSize: '15px', outline: 'none', background: '#fff' }}
          />
          <button
            disabled={loading}
            type="submit"
            style={{ width: '48px', height: '48px', background: '#4a5d23', color: '#fff', borderRadius: '12px', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            <Plus size={20} />
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {horses.map(horse => {
            const isEditing = editingHorseId === horse.id;
            return (
              <div key={horse.id} style={{ background: '#fff', padding: '14px 16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: '#fff5e6', color: '#b45309', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 22H18v-3l-2-2v-3l1-2V8c0-1-1-1.5-2-1V5c0-1-1-1.5-2-1H9c-1 0-2 1-2 2v2c0 .5-.5 1-1 1H5l-1 2 2 3v3l-2 2v3h6.5" /><path d="M9 11v-1" /></svg>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                        <input
                          type="text"
                          value={editingHorseName}
                          onChange={(e) => setEditingHorseName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditHorse(horse.id);
                            if (e.key === 'Escape') setEditingHorseId(null);
                          }}
                          autoFocus
                          style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--ink)',
                            fontSize: '14px',
                            fontWeight: 600,
                            outline: 'none',
                            color: 'var(--ink)',
                            background: '#FAF8F5',
                            width: '100%',
                            maxWidth: '180px'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditHorse(horse.id)}
                          disabled={savingHorseId === horse.id}
                          title="Simpan Nama"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#4a5d23',
                            color: '#FFF',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingHorseId(null)}
                          title="Batal"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#F4F4F5',
                            color: 'var(--muted)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          {horse.name}
                        </span>
                        {horse.status === 'INACTIVE' && (
                          <span style={{ fontSize: '10px', padding: '2px 7px', background: '#fee2e2', color: '#b91c1c', borderRadius: '100px', fontWeight: 700, flexShrink: 0 }}>
                            Istirahat
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div className="horse-menu-container" style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      type="button"
                      title="Opsi Kuda"
                      onClick={() => setOpenHorseMenuId(openHorseMenuId === horse.id ? null : horse.id)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: openHorseMenuId === horse.id ? '#FAF8F5' : '#fff',
                        color: 'var(--ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openHorseMenuId === horse.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          right: 0,
                          background: '#fff',
                          borderRadius: '14px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                          border: '1px solid rgba(0,0,0,0.06)',
                          overflow: 'hidden',
                          zIndex: 100,
                          minWidth: '160px',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenHorseMenuId(null);
                            handleStartEditHorse(horse);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--ink)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF8F5')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Pencil size={14} color="var(--muted)" />
                          <span>Edit Nama</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenHorseMenuId(null);
                            handleToggleStatus(horse.id, horse.status);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: horse.status === 'ACTIVE' ? 'var(--ink)' : '#4a5d23',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF8F5')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Clock size={14} color={horse.status === 'ACTIVE' ? 'var(--muted)' : '#4a5d23'} />
                          <span>{horse.status === 'ACTIVE' ? 'Istirahatkan' : 'Aktifkan'}</span>
                        </button>

                        <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)', margin: '4px 0' }} />

                        <button
                          type="button"
                          onClick={() => {
                            setOpenHorseMenuId(null);
                            handleDeleteHorse(horse.id, horse.name);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#b91c1c',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Trash2 size={14} color="#b91c1c" />
                          <span>Hapus Kuda</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {horses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', fontSize: '14px', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              Belum ada kuda yang terdaftar.<br />Tambahkan kuda di atas.
            </div>
          )}
        </div>

        <div style={{ marginTop: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ font: '24px var(--font-display)', margin: '0 0 4px', color: 'var(--ink)' }}>Waktu & Operasional</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Atur waktu operasional dan ketentuan pemesanan.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#edf2eb', color: '#4a5d23', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
              <Clock size={14} /> Operasional
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', marginBottom: '32px' }}>
            {/* Batas Waktu Reschedule */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ width: '44px', height: '44px', background: '#edf2eb', color: '#4a5d23', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }}>
                <Clock size={20} />
              </div>
              <div style={{ flex: 1, paddingRight: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Batas Waktu Reschedule (Jam)</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Batas minimum sebelum sesi dimulai.</div>
              </div>
              <div className="dropdown-container" style={{ position: 'relative' }}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'reschedule' ? null : 'reschedule')}
                  style={{ background: '#f4f4f5', padding: '10px 14px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', border: 'none', outline: 'none', color: 'var(--ink)', cursor: 'pointer', minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
                >
                  {rescheduleHours} Jam
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openDropdown === 'reschedule' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {openDropdown === 'reschedule' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden', zIndex: 100, minWidth: '120px' }}>
                    {['12', '24', '48'].map(val => (
                      <div
                        key={val}
                        onClick={() => { setRescheduleHours(val); setOpenDropdown(null); }}
                        style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)', background: rescheduleHours === val ? '#f4f4f5' : '#fff', color: rescheduleHours === val ? 'var(--ink)' : 'var(--muted)' }}
                      >
                        {val} Jam
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Jam Tutup Sesi Akhir */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ width: '44px', height: '44px', background: '#edf2eb', color: '#4a5d23', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }}>
                <Clock size={20} />
              </div>
              <div style={{ flex: 1, paddingRight: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Jam Tutup Kandang (Sesi Terakhir)</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Tentukan jam operasional buka sampai malam (misal 21:00).</div>
              </div>
              <div className="dropdown-container" style={{ position: 'relative' }}>
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'endTime' ? null : 'endTime')}
                  style={{ background: '#f4f4f5', padding: '10px 14px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', border: 'none', outline: 'none', color: 'var(--ink)', cursor: 'pointer', minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}
                >
                  {afternoonEndTime}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openDropdown === 'endTime' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {openDropdown === 'endTime' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden', zIndex: 100, minWidth: '120px' }}>
                    {['18:00', '19:00', '20:00', '21:00', '22:00'].map(val => (
                      <div
                        key={val}
                        onClick={async () => {
                          setAfternoonEndTime(val);
                          setOpenDropdown(null);
                          const res = await updateAfternoonEndTime(val + ':00');
                          if (res.ok) {
                            toast.custom((t) => <AlertToast title="Berhasil" description={`Jam tutup diupdate ke ${val}.`} onDismiss={() => toast.dismiss(t)} />);
                          } else {
                            toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Unknown error'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
                          }
                        }}
                        style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)', background: afternoonEndTime === val ? '#f4f4f5' : '#fff', color: afternoonEndTime === val ? 'var(--ink)' : 'var(--muted)' }}
                      >
                        {val}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Maksimal Booking Sesi per Minggu (per Member) */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
              <div style={{ width: '44px', height: '44px', background: '#edf2eb', color: '#4a5d23', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }}>
                <Calendar size={20} />
              </div>
              <div style={{ flex: 1, paddingRight: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Maksimal Booking per Minggu</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Batas sesi per minggu untuk member reguler (Silver & Gold bebas tanpa batas).</div>
              </div>
              <div className="dropdown-container" style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'maxWeekly' ? null : 'maxWeekly')}
                  style={{ background: '#f4f4f5', padding: '10px 14px', borderRadius: '12px', fontWeight: 600, fontSize: '14px', border: 'none', outline: 'none', color: 'var(--ink)', cursor: 'pointer', minWidth: '100px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                >
                  {maxWeeklyBookings === '999' ? 'Bebas' : `${maxWeeklyBookings} Sesi`}
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openDropdown === 'maxWeekly' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {openDropdown === 'maxWeekly' && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden', zIndex: 100, minWidth: '140px' }}>
                    {[
                      { label: '1 Sesi / Minggu', val: '1' },
                      { label: '2 Sesi / Minggu', val: '2' },
                      { label: '3 Sesi / Minggu', val: '3' },
                      { label: '4 Sesi / Minggu', val: '4' },
                      { label: '5 Sesi / Minggu', val: '5' },
                      { label: 'Bebas (Tanpa Batas)', val: '999' }
                    ].map(item => (
                      <div
                        key={item.val}
                        onClick={() => { setMaxWeeklyBookings(item.val); setOpenDropdown(null); }}
                        style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.03)', background: maxWeeklyBookings === item.val ? '#f4f4f5' : '#fff', color: maxWeeklyBookings === item.val ? 'var(--ink)' : 'var(--muted)' }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* CONTACT */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ font: '24px var(--font-display)', margin: '0 0 4px', color: 'var(--ink)' }}>Kontak & Bantuan</h2>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>Informasi kontak untuk bantuan dan komunikasi.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#edf2eb', color: '#4a5d23', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
              <Headphones size={14} /> Bantuan
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px' }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ width: '44px', height: '44px', background: '#458553', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', flexShrink: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>Nomor WhatsApp Admin</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>Nomor tujuan untuk tombol "Hubungi Admin" di aplikasi member.</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f4f4f5', padding: '12px 16px', borderRadius: '12px', alignSelf: 'stretch' }}>
                <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--muted)', marginRight: '8px' }}>+62</span>
                <input type="tel" value={waNumber} onChange={(e) => setWaNumber(e.target.value.replace(/[^0-9 ]/g, ''))} placeholder="812 3194 014" style={{ background: 'transparent', fontWeight: 600, fontSize: '15px', color: 'var(--ink)', border: 'none', outline: 'none', width: '100%', letterSpacing: '0.5px' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Delete Horse Modal */}
      {confirmDeleteHorse && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#FFF', borderRadius: '24px', padding: '24px',
            width: 'calc(100% - 48px)', maxWidth: '320px', textAlign: 'center'
          }}>
            <div style={{ background: '#fee2e2', color: '#b91c1c', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Hapus Kuda?</h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', lineHeight: '1.5' }}>
              Yakin ingin menghapus kuda <b>{confirmDeleteHorse.name}</b> secara permanen dari stable?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setConfirmDeleteHorse(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: '1px solid var(--line)', background: '#FFF', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Kembali
              </button>
              <button
                onClick={executeDeleteHorse}
                style={{ flex: 1, padding: '12px', borderRadius: '100px', border: 'none', background: '#b91c1c', color: '#FFF', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '24px', paddingTop: 0, paddingBottom: '48px' }}>
        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          style={{ width: '100%', padding: '16px', background: '#4a5d23', color: '#fff', borderRadius: '16px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(74, 93, 35, 0.2)', opacity: savingSettings ? 0.7 : 1 }}
        >
          <Save size={18} /> {savingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>
  );
}
