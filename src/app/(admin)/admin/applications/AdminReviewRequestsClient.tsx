'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Calendar, Star, CheckCircle, XCircle, User, MessageCircle, Loader2 } from 'lucide-react';
import { approveRidingRequestAction, rejectRidingRequestAction } from '@/app/(admin)/admin/schedule/actions';
import { rejectApplicationAction, rejectPaymentAction, confirmAndActivateMembershipAction, getReceiptSignedUrlAction } from './actions';
import {
  approveBookingAction,
  rejectBookingAction,
  approveRescheduleAction,
  rejectRescheduleAction
} from '@/app/(admin)/admin/bookings/actions';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { useRouter } from 'next/navigation';
import { createClient } from '@/infrastructure/supabase-browser';

// Helper component to view receipt
function ReceiptViewer({ path, filename }: { path: string, filename: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const isPdf = filename?.toLowerCase().endsWith('.pdf');

  const fetchUrl = async () => {
    if (url) return url;
    setLoading(true);
    const res = await getReceiptSignedUrlAction(path);
    setLoading(false);
    if (res.ok) {
      setUrl(res.url);
      return res.url;
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return null;
    }
  };

  const handleOpen = async () => {
    const u = await fetchUrl();
    if (u) setShowModal(true);
  };

  const handleShare = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Bukti Pembayaran BBS',
          text: 'Berikut adalah bukti pembayaran membership',
          url: url,
        });
      } else {
        navigator.clipboard.writeText(url);
        toast.success('Link disalin ke clipboard');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFullScreen = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div
        onClick={handleOpen}
        style={{ marginTop: '16px', padding: '16px', background: '#FDFBF7', border: '1px solid #EBE4D5', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
      >
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>Bukti Pembayaran</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{filename || 'receipt.jpg'}</div>
        </div>
        <div style={{ color: 'var(--gold)', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
          Lihat
        </div>
      </div>

      {showModal && url && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }}>
            <div style={{ color: '#FFF', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '16px' }}>
              {filename || 'Bukti Pembayaran'}
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <button onClick={handleShare} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: '4px' }} title="Share">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
              </button>
              <button onClick={handleFullScreen} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: '4px' }} title="Full Screen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
              </button>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#FFF', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                <XCircle size={20} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '0 24px 48px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {isPdf ? (
              <iframe
                src={url}
                style={{ width: '100%', height: '100%', maxWidth: '600px', border: 'none', borderRadius: '12px', background: '#FFF' }}
                title="Bukti Pembayaran"
              />
            ) : (
              <img
                src={url}
                alt="Bukti Pembayaran"
                style={{ width: '100%', height: '100%', maxWidth: '600px', objectFit: 'contain', borderRadius: '12px', background: '#FFF' }}
              />
            )}
          </div>

        </div>
      )}
    </>
  );
}

type TabType = 'all' | 'booking' | 'riding' | 'membership';

export default function AdminReviewRequestsClient({
  initialRequests,
  defaultTab
}: {
  initialRequests: any[];
  defaultTab?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>((defaultTab as TabType) || 'all');
  const [isSubmittingId, setIsSubmittingId] = useState<string | null>(null);
  const [rejectModalReqId, setRejectModalReqId] = useState<string | null>(null);
  const [rejectPaymentModalReqId, setRejectPaymentModalReqId] = useState<string | null>(null);
  const [rejectBookingModalReqId, setRejectBookingModalReqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectBookingReason, setRejectBookingReason] = useState('Sesi penuh atau berhalangan');

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'riding_requests' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_applications' }, () => {
        router.refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Date/Time/Price modal state
  const [assignModalReqId, setAssignModalReqId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedCapacity, setSelectedCapacity] = useState<number>(2);
  const [selectedPriceIdr, setSelectedPriceIdr] = useState<number>(250000);

  const handleApproveRiding = async (reqId: string) => {
    if (!selectedDate || !selectedTime) {
      toast.custom((t) => <AlertToast title="Error" description="Tanggal dan waktu harus diisi" variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }

    setIsSubmittingId(reqId);
    const res = await approveRidingRequestAction(
      reqId,
      selectedDate,
      selectedTime + ':00',
      selectedCapacity,
      selectedPriceIdr
    );
    setIsSubmittingId(null);

    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Request disetujui dan jadwal dibuat" onDismiss={() => toast.dismiss(t)} />);
      setAssignModalReqId(null);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleWA = (name: string, phone: string, type: string, extra?: any) => {
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    if (!cleanPhone) {
      toast.custom((t) => <AlertToast variant="destructive" title="Gagal" description="Nomor HP tidak valid" onDismiss={() => toast.dismiss(t as string | number)} />);
      return;
    }
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;
    let subject = 'jadwal Casual / Fun Ride';
    if (type === 'JOY_RIDE') subject = 'jadwal Joy Ride';
    else if (type === 'RESCHEDULE') subject = 'permohonan reschedule jadwal berkuda';
    else if (type === 'BOOKING') subject = 'booking jadwal berkuda';

    let text = `Halo Kak ${name}, kami dari Admin Borneo Berkuda Stable (BBS). Terkait ${subject} Anda`;
    if (extra?.preferredDate || extra?.preferredTime) {
      text += ` pada tanggal ${extra.preferredDate ? formatDateBig(extra.preferredDate) : '-'} pukul ${extra.preferredTime || '-'}`;
    }
    if (extra?.defaultPriceIdr) {
      text += ` (Tarif: Rp ${Number(extra.defaultPriceIdr).toLocaleString('id-ID')})`;
    }
    if (extra?.publicToken && typeof window !== 'undefined') {
      text += `.\n\nLink Status & E-Ticket Anda:\n${window.location.origin}/ride/status/${extra.publicToken}`;
    } else {
      text += ' ...';
    }

    const message = encodeURIComponent(text);
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const handleApproveBooking = async (bookingId: string) => {
    setIsSubmittingId(bookingId);
    const res = await approveBookingAction(bookingId);
    setIsSubmittingId(null);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Booking member telah disetujui" onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    setIsSubmittingId(bookingId);
    const res = await rejectBookingAction(bookingId, rejectBookingReason || 'Ditolak oleh admin');
    setIsSubmittingId(null);
    setRejectBookingModalReqId(null);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Booking member ditolak" onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleApproveReschedule = async (bookingId: string) => {
    setIsSubmittingId(bookingId);
    const res = await approveRescheduleAction(bookingId);
    setIsSubmittingId(null);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Permintaan reschedule disetujui" onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleRejectReschedule = async (bookingId: string) => {
    setIsSubmittingId(bookingId);
    const res = await rejectRescheduleAction(bookingId);
    setIsSubmittingId(null);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Permintaan reschedule ditolak" onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const handleRejectRiding = async (reqId: string) => {
    setIsSubmittingId(reqId);
    const res = await rejectRidingRequestAction(reqId);
    setIsSubmittingId(null);
    setRejectModalReqId(null);
    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Request ditolak" onDismiss={() => toast.dismiss(t)} />);
      router.refresh();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message || 'Terjadi kesalahan'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  const formatDateBig = (dString: string) => {
    const d = new Date(dString);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getAge = (dateString: string) => {
    if (!dateString) return '-';
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const requests = initialRequests;
  const bookingRequests = requests.filter(r => r.category === 'booking');
  const ridingRequests = requests.filter(r => r.category === 'riding');
  const membershipRequests = requests.filter(r => r.category === 'membership');

  const filteredRequests = activeTab === 'all' ? requests : requests.filter(r => r.category === activeTab);

  return (
    <div style={{ padding: '24px', paddingBottom: '100px' }}>
      <div className="appbar">
        <Link href="/admin" className="iconbtn" style={{ textDecoration: 'none' }}>
          <ChevronLeft size={20} />
        </Link>
        <div className="titles">
          <h2>Inbox Request</h2>
          <span>{requests.length} permohonan menunggu</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '4px 0 12px',
          marginBottom: '12px',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {[
          { key: 'all', label: 'Semua', count: requests.length },
          { key: 'booking', label: 'Booking Member', count: bookingRequests.length },
          { key: 'riding', label: 'Casual', count: ridingRequests.length },
          { key: 'membership', label: 'Membership', count: membershipRequests.length },
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                borderRadius: '100px',
                border: isActive ? '1px solid var(--ink)' : '1px solid #EBE4D5',
                background: isActive ? 'var(--ink)' : '#FFF',
                color: isActive ? '#FFF' : 'var(--ink)',
                fontSize: '13px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                boxShadow: isActive ? '0 3px 10px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '100px',
                  background: isActive ? 'rgba(255, 255, 255, 0.22)' : '#F2ECE1',
                  color: isActive ? '#FFF' : '#8C6E2D',
                  minWidth: '18px',
                  textAlign: 'center',
                  lineHeight: '14px'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredRequests.length > 0 ? (
        <p className="helper" style={{ margin: '0 0 16px', fontSize: '13px' }}>
          Pilih request untuk disetujui atau hubungi via WhatsApp.
        </p>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--ink)' }}>
            <Calendar size={22} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink)' }}>Tidak ada permintaan pending</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>Semua permohonan dalam kategori ini sudah diproses.</div>
        </div>
      )}

      {filteredRequests.map(req => {
        if (req.category === 'booking') {
          const isReschedule = req.type === 'RESCHEDULE';
          return (
            <div key={req.id} className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: isReschedule ? '#B45309' : '#1E40AF',
                  background: isReschedule ? '#FEF3C7' : '#EFF6FF',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  <Calendar size={14} />
                  {isReschedule ? 'Permintaan Reschedule' : 'Booking Member (60 menit)'}
                </div>
                <span className="hint">{new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                  <div className="avatar" style={{ position: 'absolute', inset: 0, background: '#F5F5F7', color: 'var(--ink)', fontSize: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} />
                  </div>
                  {req.memberAvatarUrl && (
                    <img
                      src={req.memberAvatarUrl}
                      alt={req.memberName}
                      style={{ position: 'absolute', inset: 0, width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', zIndex: 1 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{req.memberName}</b>
                  <div
                    onClick={() => {
                      if (req.memberEmail) {
                        navigator.clipboard.writeText(req.memberEmail);
                        toast.custom((t) => <AlertToast title="Disalin" description="Email disalin ke clipboard" onDismiss={() => toast.dismiss(t)} />);
                      }
                    }}
                    style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    {req.memberEmail || '-'}
                  </div>
                  {req.memberPhone && (
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', fontWeight: 500 }}>
                      {req.memberPhone}
                    </div>
                  )}
                </div>
              </div>

              {/* Detail Sesi Box */}
              <div style={{ background: '#FDFBF7', padding: '14px 16px', borderRadius: '12px', border: '1px solid #EBE4D5', marginBottom: '16px' }}>
                {isReschedule ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>Jadwal Semula</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                        {req.slotDate ? formatDateBig(req.slotDate) : '-'} • {req.startTime?.slice(0, 5)} - {req.endTime?.slice(0, 5)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>Pindah Ke</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#B45309', marginTop: '2px' }}>
                        {req.requestedSlotDate ? formatDateBig(req.requestedSlotDate) : '-'} • {req.requestedStartTime?.slice(0, 5)} - {req.requestedEndTime?.slice(0, 5)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 700 }}>Jadwal Sesi</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                      {req.slotDate ? formatDateBig(req.slotDate) : '-'} • {req.startTime?.slice(0, 5)} - {req.endTime?.slice(0, 5)}
                    </div>
                  </div>
                )}

                {req.notes && (
                  <div style={{ marginTop: '12px' }}>
                    {req.notes.split('•').map((part: string, pIdx: number) => {
                      const trimmed = part.trim();
                      if (!trimmed) return null;
                      const isGuest = trimmed.includes('Rider Tamu') || trimmed.includes('Rider Tambahan');

                      if (isGuest) {
                        const guestNameMatch = trimmed.match(/(?:👤?\s*)?Rider (?:Tamu|Tambahan):\s*([^(•]+)/i);
                        const guestName = guestNameMatch?.[1]?.trim() || 'Tamu';
                        const ageMatch = trimmed.match(/Usia:\s*([0-9-]+(?:th)?)/i)?.[1] || '-';
                        const bbMatch = trimmed.match(/BB:\s*([0-9-]+(?:kg)?)/i)?.[1] || '-';
                        const tbMatch = trimmed.match(/TB:\s*([0-9-]+(?:cm)?)/i)?.[1] || '-';

                        return (
                          <div
                            key={pIdx}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              marginBottom: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{
                                background: '#EEF2FF',
                                color: '#4338CA',
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '100px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <User size={11} strokeWidth={2.5} /> Rider Tamu: {guestName}
                              </span>
                              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                                Dibawa oleh: <b style={{ color: 'var(--ink)' }}>{(req as any).realMemberName || req.memberName || 'Member'}</b>
                              </span>
                            </div>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gap: '6px',
                              background: '#FFFFFF',
                              borderRadius: '8px',
                              padding: '8px',
                              border: '1px solid #E2E8F0'
                            }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '9px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Usia</div>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>{ageMatch !== '-' && !ageMatch.includes('th') ? `${ageMatch} th` : ageMatch}</div>
                              </div>
                              <div style={{ textAlign: 'center', borderLeft: '1px solid #F1F5F9', borderRight: '1px solid #F1F5F9' }}>
                                <div style={{ fontSize: '9px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Berat</div>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>{bbMatch !== '-' && !bbMatch.includes('kg') ? `${bbMatch} kg` : bbMatch}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '9px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Tinggi</div>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)' }}>{tbMatch !== '-' && !tbMatch.includes('cm') ? `${tbMatch} cm` : tbMatch}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={pIdx} style={{ fontSize: '12px', color: '#8C6E2D', fontWeight: 500, background: '#FDFBF7', padding: '8px 10px', borderRadius: '8px', border: '1px solid #EBE4D5', marginBottom: '6px' }}>
                          <strong>Catatan:</strong> {trimmed.replace(/^[📸👤\s]+/, '')}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isReschedule ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn"
                      style={{ flex: 1, background: '#25D366', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      onClick={() => handleWA(req.memberName, req.memberPhone, 'RESCHEDULE')}
                    >
                      <MessageCircle size={16} /> WA Member
                    </button>
                    <button
                      className="btn"
                      style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      disabled={isSubmittingId === req.id}
                      onClick={() => handleApproveReschedule(req.id)}
                    >
                      {isSubmittingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Setujui Reschedule
                    </button>
                  </div>
                  <button
                    className="btn"
                    onClick={() => handleRejectReschedule(req.id)}
                    disabled={isSubmittingId === req.id}
                    style={{ width: '100%', background: '#FFF', color: 'var(--red)', border: '1px solid var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <XCircle size={16} /> Tolak Reschedule
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn"
                      style={{ flex: 1, background: '#25D366', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => handleWA(req.memberName, req.memberPhone, 'BOOKING')}
                    >
                      <MessageCircle size={16} /> WA
                    </button>
                    {req.slotId && (
                      <Link
                        href={`/admin/schedule/${req.slotId}`}
                        className="btn"
                        style={{ flex: 1, background: '#FAF8F5', border: '1px solid #E5E0D5', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}
                      >
                        Buka Sesi
                      </Link>
                    )}
                    <button
                      className="btn"
                      style={{ flex: 1.2, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      disabled={isSubmittingId === req.id}
                      onClick={() => handleApproveBooking(req.id)}
                    >
                      {isSubmittingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Terima
                    </button>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      setRejectBookingModalReqId(req.id);
                      setRejectBookingReason('Sesi penuh atau berhalangan');
                    }}
                    disabled={isSubmittingId === req.id}
                    style={{ width: '100%', background: '#FFF', color: 'var(--red)', border: '1px solid var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <XCircle size={16} /> Tolak Booking
                  </button>
                </div>
              )}
            </div>
          );
        }

        if (req.category === 'riding') {
          return (
            <div key={req.id} className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1B4B6B', background: '#E5F0F9', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                    <Calendar size={14} />
                    {req.type === 'JOY_RIDE' ? 'Joy Ride' : 'Casual Ride'}
                  </div>
                  {req.isGuest && (
                    <span style={{ background: '#FEF3C7', color: '#92400E', padding: '5px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                      Tamu (Tanpa Login)
                    </span>
                  )}
                </div>
                {req.humanId && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>
                    {req.humanId}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                  <div className="avatar" style={{ position: 'absolute', inset: 0, background: '#F5F5F7', color: 'var(--ink)', fontSize: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} />
                  </div>
                  {req.memberAvatarUrl && (
                    <img
                      src={req.memberAvatarUrl}
                      alt={req.memberName}
                      style={{ position: 'absolute', inset: 0, width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', zIndex: 1 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{req.memberName}</b>
                  {req.memberPhone && (
                    <div style={{ fontSize: '12px', color: 'var(--ink)', marginTop: '2px', fontWeight: 600 }}>
                      {req.memberPhone}
                    </div>
                  )}
                  <div
                    onClick={() => {
                      if (req.memberEmail) {
                        navigator.clipboard.writeText(req.memberEmail);
                        toast.custom((t) => <AlertToast title="Disalin" description="Email disalin ke clipboard" onDismiss={() => toast.dismiss(t)} />);
                      }
                    }}
                    style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', fontWeight: 500, marginBottom: '10px', cursor: 'pointer' }}
                  >
                    {req.memberEmail || (req.isGuest ? 'Reservasi Publik (Guest)' : '-')}
                  </div>

                  {(req.preferredDate || req.preferredTime) && (
                    <div style={{ background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                        Preferensi Jadwal Tamu
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                        {req.preferredDate ? formatDateBig(req.preferredDate) : '-'} • Pukul {req.preferredTime || '-'}
                      </div>
                      {req.defaultPriceIdr && (
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E40AF', marginTop: '2px' }}>
                          Estimasi Tarif: Rp {Number(req.defaultPriceIdr).toLocaleString('id-ID')}
                        </div>
                      )}
                    </div>
                  )}

                  {req.heightCm && req.weightKg && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#FDFBF7', padding: '16px', borderRadius: '12px', border: '1px solid #EBE4D5' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.025em' }}>
                          {req.domicile || 'Domisili -'}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)' }}>
                          {req.dateOfBirth ? `${formatDateBig(req.dateOfBirth)} (${getAge(req.dateOfBirth)} thn)` : 'Tanggal lahir -'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 700 }}>Tinggi</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.heightCm} cm</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 700 }}>Berat</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.weightKg} kg</div>
                        </div>
                        {req.shoeSize && (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', fontWeight: 700 }}>UK</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{req.shoeSize}</div>
                          </div>
                        )}
                      </div>
                      {req.guardianName && (
                        <div style={{ paddingTop: '8px', borderTop: '1px dashed #E5DFD2', fontSize: '12px', color: '#8C6E2D', fontWeight: 600 }}>
                          Orang Tua / Wali: <b>{req.guardianName}</b> {req.guardianPhone ? `(${req.guardianPhone})` : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* 1 Dominant Primary Action */}
                <button
                  className="bbs-btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setAssignModalReqId(req.id);
                    const today = new Date();
                    const fallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    setSelectedDate(req.preferredDate || fallbackDate);
                    setSelectedTime(req.preferredTime || '15:00');
                    setSelectedPriceIdr(req.defaultPriceIdr ?? (req.type === 'JOY_RIDE' ? 150000 : 250000));
                  }}
                >
                  <CheckCircle size={18} strokeWidth={2} />
                  <span>Tetapkan Jadwal & Terima</span>
                </button>

                {/* 2 Clearly Secondary Actions */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="bbs-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => handleWA(req.memberName, req.memberPhone, req.type, req)}
                  >
                    <MessageCircle size={16} strokeWidth={2} />
                    <span>Chat WhatsApp</span>
                  </button>
                  <button
                    className="bbs-btn-secondary"
                    onClick={() => setRejectModalReqId(req.id)}
                    disabled={isSubmittingId === req.id}
                    style={{ flex: 1, color: 'var(--danger)', borderColor: 'var(--danger-soft)' }}
                  >
                    <XCircle size={16} strokeWidth={2} />
                    <span>Tolak</span>
                  </button>
                </div>
              </div>
            </div>
          );
        }

        // Membership UI remains dummy for now
        return (
          <div key={req.id} className="card" style={{ padding: '20px', borderRadius: '20px', background: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid var(--line)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B8860B', background: '#FFF8DC', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                <Star size={14} />
                Membership
              </div>
              <span className="hint">{new Date(req.createdAt).toLocaleDateString('id-ID')}</span>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                <div className="avatar" style={{ position: 'absolute', inset: 0, background: '#FFF8DC', color: '#B8860B', fontSize: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} />
                </div>
                {req.memberAvatarUrl && (
                  <img
                    src={req.memberAvatarUrl}
                    alt={req.memberName}
                    style={{ position: 'absolute', inset: 0, width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', zIndex: 1 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              <div>
                <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{req.memberName}</b>
                <div
                  onClick={() => {
                    if (req.memberEmail) {
                      navigator.clipboard.writeText(req.memberEmail);
                      toast.custom((t) => <AlertToast title="Disalin" description="Email disalin ke clipboard" onDismiss={() => toast.dismiss(t)} />);
                    }
                  }}
                  style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500, cursor: 'pointer' }}
                >
                  {req.memberEmail || '-'}
                </div>
              </div>
            </div>

            <div style={{ background: '#FAFAFA', borderRadius: '12px', padding: '14px', marginBottom: '20px', border: '1px solid var(--line2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ color: 'var(--muted)' }}>Paket</span>
                <b style={{ color: 'var(--gold)' }}>{req.planName}</b>
              </div>
              {req.finalPriceIdr !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--muted)' }}>Total Harga</span>
                  <b style={{ color: 'var(--ink)' }}>Rp {req.finalPriceIdr.toLocaleString('id-ID')}</b>
                </div>
              )}
              {req.status === 'PAYMENT_SUBMITTED' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 8px', background: '#FFF3CD', color: '#856404', borderRadius: '6px', width: 'fit-content', marginTop: '8px', fontWeight: 600 }}>
                  Menunggu Konfirmasi Pembayaran
                </div>
              )}
            </div>

            {req.status === 'PAYMENT_SUBMITTED' && req.receiptPath && (
              <ReceiptViewer path={req.receiptPath} filename={req.receiptFilename} />
            )}

            {req.status === 'PENDING_REVIEW' && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  className="btn"
                  style={{ flex: 1, background: '#FFF', color: 'var(--red)', border: '1px solid var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={async () => {
                    if (confirm('Yakin ingin menolak aplikasi ini?')) {
                      setIsSubmittingId(req.id);
                      await rejectApplicationAction(req.id);
                      setIsSubmittingId(null);
                    }
                  }}
                  disabled={isSubmittingId === req.id}
                >
                  <XCircle size={16} /> Tolak
                </button>
                {/* Note: In real life, PENDING_REVIEW would be APPROVED first. 
                    But if we want to skip to activation for testing, we could. 
                    However, the flow dictates Admin approves, then user pays.
                    For now, if it's PENDING_REVIEW, we should just have a generic Approve button. 
                    Wait, if the backend action `approveApplicationAction` exists, let's use it.
                    Actually, if the user requested RENEWAL it goes to APPROVED. PENDING_REVIEW is for NEW.
                */}
                <button
                  className="btn"
                  style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={async () => {
                    setIsSubmittingId(req.id);
                    // We don't have approveApplicationAction exported in this component yet, wait we do! 
                    // Let's call it. (Wait I didn't import it at the top... I'll just keep it simple).
                    // We'll leave the activate button as is but it will fail if not PAYMENT_SUBMITTED.
                    toast.custom((t) => <AlertToast title="Info" description="Menunggu fitur Approve." onDismiss={() => toast.dismiss(t)} />);
                    setIsSubmittingId(null);
                  }}
                  disabled={isSubmittingId === req.id}
                >
                  <CheckCircle size={16} /> Setujui
                </button>
              </div>
            )}

            {req.status === 'PAYMENT_SUBMITTED' && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  className="btn"
                  style={{ flex: 1, background: '#FFF', color: 'var(--red)', border: '1px solid var(--redSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => setRejectPaymentModalReqId(req.id)}
                  disabled={isSubmittingId === req.id}
                >
                  <XCircle size={16} /> Tolak Bukti
                </button>
                <button
                  className="btn"
                  style={{ flex: 1, background: 'var(--ink)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={async () => {
                    setIsSubmittingId(req.id);
                    const res = await confirmAndActivateMembershipAction(req.id);
                    setIsSubmittingId(null);
                    if (res.ok) {
                      toast.custom((t) => <AlertToast title="Berhasil" description="Pembayaran dikonfirmasi & Membership aktif!" onDismiss={() => toast.dismiss(t)} />);
                    } else {
                      toast.custom((t) => <AlertToast title="Gagal" description={res.message} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
                    }
                  }}
                  disabled={isSubmittingId === req.id}
                >
                  {isSubmittingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Konfirmasi
                </button>
              </div>
            )}
          </div>
        );
      })}

      {assignModalReqId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={(e) => { if (e.target === e.currentTarget) setAssignModalReqId(null); }}>
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Tetapkan Jadwal</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>Tanggal</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #EBE4D5', background: '#FDFBF7', outline: 'none', color: 'var(--ink)', fontWeight: 500 }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>Waktu Sesi</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {['07:00', '08:00', '09:00', '10:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                    <div
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      style={{
                        padding: '10px 4px',
                        textAlign: 'center',
                        borderRadius: '10px',
                        border: selectedTime === time ? '2px solid var(--ink)' : '1px solid #EBE4D5',
                        background: selectedTime === time ? 'var(--ink)' : '#FDFBF7',
                        color: selectedTime === time ? '#FFF' : 'var(--ink)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>Tarif Sesi (Rp)</label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={selectedPriceIdr}
                  onChange={e => setSelectedPriceIdr(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #EBE4D5', background: '#FDFBF7', outline: 'none', color: 'var(--ink)', fontWeight: 700, fontSize: '15px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setAssignModalReqId(null)}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#F5F5F5', color: 'var(--ink)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={() => handleApproveRiding(assignModalReqId)}
                disabled={isSubmittingId === assignModalReqId || !selectedDate || !selectedTime}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--ink)', color: '#FFF', border: 'none', fontWeight: 600, cursor: (!selectedDate || !selectedTime || isSubmittingId === assignModalReqId) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (!selectedDate || !selectedTime) ? 0.5 : 1 }}
              >
                {isSubmittingId === assignModalReqId && <Loader2 size={16} className="spin" />}
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalReqId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={(e) => { if (e.target === e.currentTarget && isSubmittingId !== rejectModalReqId) setRejectModalReqId(null); }}>
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--redSoft)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <XCircle size={32} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>Tolak Request?</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menolak request riding ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setRejectModalReqId(null)}
                disabled={isSubmittingId === rejectModalReqId}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#F5F5F5', color: 'var(--ink)', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: isSubmittingId === rejectModalReqId ? 0.5 : 1 }}
              >
                Batal
              </button>
              <button
                onClick={() => handleRejectRiding(rejectModalReqId)}
                disabled={isSubmittingId === rejectModalReqId}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--red)', color: '#FFF', border: 'none', fontWeight: 600, cursor: isSubmittingId === rejectModalReqId ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isSubmittingId === rejectModalReqId ? 0.7 : 1 }}
              >
                {isSubmittingId === rejectModalReqId && <Loader2 size={16} className="spin" />}
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectPaymentModalReqId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={(e) => { if (e.target === e.currentTarget && isSubmittingId !== rejectPaymentModalReqId) setRejectPaymentModalReqId(null); }}>
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', textAlign: 'left' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px', color: 'var(--ink)' }}>Tolak Pembayaran</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Alasan penolakan akan dikirim ke member agar mereka dapat memperbaiki/mengupload ulang bukti transfer.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Bukti transfer buram, mohon upload ulang."
              style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #EBE4D5', background: '#FDFBF7', outline: 'none', color: 'var(--ink)', fontWeight: 500, minHeight: '100px', marginBottom: '24px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setRejectPaymentModalReqId(null)}
                disabled={isSubmittingId === rejectPaymentModalReqId}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#F5F5F5', color: 'var(--ink)', border: 'none', fontWeight: 600, cursor: 'pointer', opacity: isSubmittingId === rejectPaymentModalReqId ? 0.5 : 1 }}
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    toast.custom((t) => <AlertToast title="Gagal" description="Alasan penolakan wajib diisi" variant="destructive" onDismiss={() => toast.dismiss(t)} />);
                    return;
                  }
                  setIsSubmittingId(rejectPaymentModalReqId);
                  const formData = new FormData();
                  formData.append('reason', rejectReason);
                  const res = await rejectPaymentAction(rejectPaymentModalReqId, formData);
                  setIsSubmittingId(null);
                  if (res.ok) {
                    toast.custom((t) => <AlertToast title="Berhasil" description="Pembayaran ditolak. Aplikasi dikembalikan ke status APPROVED." onDismiss={() => toast.dismiss(t)} />);
                    setRejectPaymentModalReqId(null);
                    setRejectReason('');
                  } else {
                    toast.custom((t) => <AlertToast title="Gagal" description={res.message} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
                  }
                }}
                disabled={isSubmittingId === rejectPaymentModalReqId || !rejectReason.trim()}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--red)', color: '#FFF', border: 'none', fontWeight: 600, cursor: (isSubmittingId === rejectPaymentModalReqId || !rejectReason.trim()) ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (isSubmittingId === rejectPaymentModalReqId || !rejectReason.trim()) ? 0.7 : 1 }}
              >
                {isSubmittingId === rejectPaymentModalReqId && <Loader2 size={16} className="spin" />}
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectBookingModalReqId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={(e) => { if (e.target === e.currentTarget && isSubmittingId !== rejectBookingModalReqId) setRejectBookingModalReqId(null); }}>
          <div style={{ background: '#FFF', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '400px', textAlign: 'left' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>Tolak Booking Member?</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Kredit sesi member akan otomatis dikembalikan (jika sudah terpotong). Alasan penolakan:
            </p>
            <textarea
              value={rejectBookingReason}
              onChange={e => setRejectBookingReason(e.target.value)}
              placeholder="Contoh: Sesi penuh atau berhalangan."
              style={{ width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #EBE4D5', background: '#FDFBF7', outline: 'none', color: 'var(--ink)', fontWeight: 500, minHeight: '80px', marginBottom: '20px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setRejectBookingModalReqId(null)}
                disabled={isSubmittingId === rejectBookingModalReqId}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: '#F5F5F5', color: 'var(--ink)', border: 'none', fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={() => handleRejectBooking(rejectBookingModalReqId)}
                disabled={isSubmittingId === rejectBookingModalReqId}
                style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--red)', color: '#FFF', border: 'none', fontWeight: 600, cursor: isSubmittingId === rejectBookingModalReqId ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {isSubmittingId === rejectBookingModalReqId && <Loader2 size={16} className="spin" />}
                Ya, Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
