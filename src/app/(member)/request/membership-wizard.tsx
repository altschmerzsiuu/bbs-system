'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ArrowRight, Check, Sparkles, User, Crown, 
  CreditCard, Upload, FileText, X, Copy, Clock, MessageCircle, 
  AlertCircle, Loader2, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import { submitMembershipApplicationFlow } from './actions';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';

interface PlanData {
  id: string;
  name: string;
  price_idr: number;
  credits: number;
  duration_months: number;
  extension_discount_idr?: number;
}

interface MemberData {
  full_name?: string;
  phone?: string;
  date_of_birth?: string;
  domicile?: string;
  height_cm?: number;
  weight_kg?: number;
  shoe_size?: number;
}

interface ExistingApplicationData {
  id: string;
  human_id: string;
  status: string;
  final_price_idr?: number;
  created_at: string;
  membership_plans?: { name: string };
  rejection_reason?: string;
}

interface MembershipWizardProps {
  initialData: MemberData;
  plans: PlanData[];
  isRenewal: boolean;
  activeApp?: ExistingApplicationData | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

const BENEFITS_BY_PLAN: Record<string, string[]> = {
  gold: [
    '10 sesi riding berkuda eksklusif',
    'Prioritas utama pemesanan slot sesi',
    'Pendampingan pelatih profesional',
    'Akses ke event spesial member BBS',
    'Helm & perlengkapan standar disediakan'
  ],
  silver: [
    'Sesi riding berkuda fleksibel',
    'Pemesanan slot terjadwal',
    'Akses fasilitas stable BBS',
    'Helm & perlengkapan standar disediakan'
  ]
};

export default function MembershipWizard({
  initialData,
  plans,
  isRenewal,
  activeApp,
  bankName,
  accountNumber,
  accountName,
}: MembershipWizardProps) {
  const router = useRouter();

  // If already in PAYMENT_SUBMITTED or PENDING_REVIEW, start directly at Step 4 (Review state)
  const initialStep = activeApp && ['PAYMENT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED'].includes(activeApp.status) 
    ? 4 
    : 1;

  const [step, setStep] = useState<number>(initialStep);

  // Form State - Step 1: Personal Data
  const [fullName, setFullName] = useState(initialData.full_name || '');
  const [phone, setPhone] = useState(initialData.phone === '-' ? '' : (initialData.phone || ''));
  const [dateOfBirth, setDateOfBirth] = useState(initialData.date_of_birth || '');
  const [domicile, setDomicile] = useState(initialData.domicile || '');
  const [heightCm, setHeightCm] = useState<string>(initialData.height_cm ? String(initialData.height_cm) : '');
  const [weightKg, setWeightKg] = useState<string>(initialData.weight_kg ? String(initialData.weight_kg) : '');
  const [shoeSize, setShoeSize] = useState<string>(initialData.shoe_size ? String(initialData.shoe_size) : '');

  // Form State - Step 2: Plan
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans.length > 0 ? plans[0].id : '');

  // Form State - Step 3: Payment
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submitted Application Data for Step 4
  const [submittedData, setSubmittedData] = useState<{
    humanId: string;
    applicationId: string;
    planName: string;
    finalPriceIdr: number;
    createdAt: string;
  } | null>(
    activeApp ? {
      humanId: activeApp.human_id,
      applicationId: activeApp.id,
      planName: activeApp.membership_plans?.name || 'Membership',
      finalPriceIdr: activeApp.final_price_idr || 0,
      createdAt: activeApp.created_at,
    } : null
  );

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];
  const discount = isRenewal ? (selectedPlan?.extension_discount_idr || 0) : 0;
  const finalPrice = Math.max(0, (selectedPlan?.price_idr || 0) - discount);

  // Copy handler
  const handleCopyAccount = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    toast.success('Nomor rekening berhasil disalin!');
    setTimeout(() => setCopied(false), 2000);
  };

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 5 * 1024 * 1024) {
        toast.custom((t) => <AlertToast title="File Terlalu Besar" description="Ukuran bukti transfer maksimal 5MB." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        return;
      }
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const removeFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Step 1 validation
  const validateStep1 = () => {
    if (!fullName.trim()) return 'Nama lengkap wajib diisi.';
    if (!phone.trim() || phone.trim().length < 8) return 'Nomor WhatsApp tidak valid.';
    if (!dateOfBirth) return 'Tanggal lahir wajib diisi.';
    if (!domicile.trim()) return 'Kota domisili wajib diisi.';
    if (!heightCm || Number(heightCm) < 50) return 'Tinggi badan wajib diisi dengan benar.';
    if (!weightKg || Number(weightKg) < 20) return 'Berat badan wajib diisi dengan benar.';
    return null;
  };

  const handleNextFromStep1 = () => {
    const err = validateStep1();
    if (err) {
      setErrorMessage(err);
      toast.custom((t) => <AlertToast title="Perhatian" description={err} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  // Step 3 submission
  const handleSubmitAll = async () => {
    if (!file) {
      setErrorMessage('Silakan upload bukti transfer pembayaran sebelum mengirim.');
      toast.custom((t) => <AlertToast title="Bukti Transfer Kosong" description="Silakan unggah foto/dokumen bukti transfer." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('fullName', fullName.trim());
    formData.append('phone', phone.trim());
    formData.append('dateOfBirth', dateOfBirth);
    formData.append('domicile', domicile.trim());
    formData.append('heightCm', heightCm);
    formData.append('weightKg', weightKg);
    if (shoeSize) formData.append('shoeSize', shoeSize);
    formData.append('planId', selectedPlanId);
    formData.append('receipt', file);

    try {
      const result = await submitMembershipApplicationFlow(formData);
      setIsSubmitting(false);

      if (!result.ok || !result.data) {
        setErrorMessage(result.error || 'Terjadi kesalahan saat mengirim pengajuan.');
        toast.custom((t) => <AlertToast title="Gagal Mengirim" description={result.error || 'Silakan coba lagi.'} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
        return;
      }

      setSubmittedData(result.data);
      setStep(4);
      toast.custom((t) => <AlertToast title="Berhasil Terkirim!" description="Bukti transfer telah diterima dan sedang direview admin." onDismiss={() => toast.dismiss(t)} />);
    } catch (e: any) {
      setIsSubmitting(false);
      setErrorMessage('Terjadi kendala jaringan. Silakan coba kembali.');
      toast.custom((t) => <AlertToast title="Error" description="Gagal menghubungi server." variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  // WhatsApp admin contact template
  const handleContactAdmin = () => {
    const text = encodeURIComponent(
      `Halo Admin BBS, saya telah mengajukan membership ${submittedData?.planName || ''} dengan ID ${submittedData?.humanId || ''} dan telah mengunggah bukti transfer. Mohon bantuannya untuk verifikasi. Terima kasih!`
    );
    window.open(`https://wa.me/6281255558888?text=${text}`, '_blank');
  };

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '48px' }}>
      
      {/* ── Top Bar ── */}
      <div style={{
        padding: '14px 20px',
        position: 'sticky',
        top: 0,
        background: 'rgba(251, 249, 245, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 20,
        borderBottom: '1px solid rgba(0,0,0,0.06)'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                if (step > 1 && step < 4) setStep(step - 1);
                else router.back();
              }}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #E5E0D5',
                cursor: 'pointer',
                color: 'var(--ink)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h1 style={{ 
                fontFamily: 'var(--font-display), "Fraunces", Georgia, serif', 
                fontSize: '17px', 
                fontWeight: 700, 
                margin: 0, 
                color: 'var(--ink)', 
                lineHeight: 1.25 
              }}>
                {step === 4 ? 'Status Pengajuan' : isRenewal ? 'Perpanjangan Membership' : 'Pendaftaran Membership'}
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                {step === 1 && 'Langkah 1 dari 3: Data Diri & Profil'}
                {step === 2 && 'Langkah 2 dari 3: Pilih Paket'}
                {step === 3 && 'Langkah 3 dari 3: Pembayaran & Bukti'}
                {step === 4 && 'Tahap Verifikasi Admin'}
              </p>
            </div>
          </div>

          {/* Badge isRenewal */}
          {isRenewal && step < 4 && (
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '100px',
              background: 'rgba(216, 188, 128, 0.22)',
              color: '#8C6E2D',
              letterSpacing: '0.6px'
            }}>
              RENEWAL
            </span>
          )}
        </div>
      </div>

      {/* ── Progress Stepper Bar (Only for steps 1-3) ── */}
      {step < 4 && (
        <div style={{ padding: '16px 20px 8px', maxWidth: '480px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            
            {/* Connecting Progress Line */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '32px',
              right: '32px',
              height: '2.5px',
              background: '#EAE5D8',
              zIndex: 1
            }}>
              <div style={{
                height: '100%',
                background: 'var(--ink)',
                width: step === 1 ? '0%' : step === 2 ? '50%' : '100%',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Step 1 Node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step >= 1 ? 'var(--ink)' : '#FFF',
                color: step >= 1 ? '#FFF' : 'var(--muted)',
                border: `2px solid ${step >= 1 ? 'var(--ink)' : '#E0DDD5'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 800,
                transition: 'all 0.2s ease',
                boxShadow: step === 1 ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
              }}>
                {step > 1 ? <Check size={15} strokeWidth={3} /> : '1'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: step === 1 ? 700 : 500, color: step === 1 ? 'var(--ink)' : 'var(--muted)' }}>
                Data Diri
              </span>
            </div>

            {/* Step 2 Node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step >= 2 ? 'var(--ink)' : '#FFF',
                color: step >= 2 ? '#FFF' : 'var(--muted)',
                border: `2px solid ${step >= 2 ? 'var(--ink)' : '#E0DDD5'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 800,
                transition: 'all 0.2s ease',
                boxShadow: step === 2 ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
              }}>
                {step > 2 ? <Check size={15} strokeWidth={3} /> : '2'}
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: step === 2 ? 700 : 500, color: step === 2 ? 'var(--ink)' : 'var(--muted)' }}>
                Pilih Paket
              </span>
            </div>

            {/* Step 3 Node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: step === 3 ? 'var(--ink)' : '#FFF',
                color: step === 3 ? '#FFF' : 'var(--muted)',
                border: `2px solid ${step === 3 ? 'var(--ink)' : '#E0DDD5'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 800,
                transition: 'all 0.2s ease',
                boxShadow: step === 3 ? '0 2px 8px rgba(0,0,0,0.12)' : 'none'
              }}>
                3
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: step === 3 ? 700 : 500, color: step === 3 ? 'var(--ink)' : 'var(--muted)' }}>
                Pembayaran
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ── Main Form Content Container ── */}
      <div style={{ maxWidth: '480px', width: '100%', margin: '0 auto', padding: '16px 20px 32px', flex: 1, boxSizing: 'border-box' }}>

        <AnimatePresence mode="wait">
          
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* STEP 1: DATA DIRI & PROFIL                                             */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <h2 style={{ 
                  fontFamily: 'var(--font-display), "Fraunces", Georgia, serif', 
                  fontSize: '22px', 
                  fontWeight: 700, 
                  color: 'var(--ink)', 
                  margin: '0 0 4px 0',
                  lineHeight: 1.25
                }}>
                  Lengkapi Data Diri
                </h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Data profil berkuda untuk administrasi keanggotaan stable Anda.
                </p>
              </div>

              {/* Card 1: Data Kontak */}
              <div style={{
                background: '#FFF',
                border: '1px solid #ECE7DC',
                borderRadius: '20px',
                padding: '22px 22px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} color="var(--ink)" />
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Informasi Kontak
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #E5E0D5',
                      background: '#FAF8F5',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                    Nomor WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                    style={{
                      width: '100%',
                      height: '48px',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #E5E0D5',
                      background: '#FAF8F5',
                      fontSize: '14px',
                      color: 'var(--ink)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                      Tanggal Lahir *
                    </label>
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #E5E0D5',
                        background: '#FAF8F5',
                        fontSize: '13.5px',
                        color: 'var(--ink)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                      Kota Domisili *
                    </label>
                    <input
                      type="text"
                      required
                      value={domicile}
                      onChange={(e) => setDomicile(e.target.value)}
                      placeholder="Balikpapan"
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: '1px solid #E5E0D5',
                        background: '#FAF8F5',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Profil Fisik */}
              <div style={{
                background: '#FFF',
                border: '1px solid #ECE7DC',
                borderRadius: '20px',
                padding: '22px 22px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} color="var(--ink)" />
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Profil Fisik Berkuda
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                      Tinggi (cm) *
                    </label>
                    <input
                      type="number"
                      required
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="170"
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '12px 12px',
                        borderRadius: '12px',
                        border: '1px solid #E5E0D5',
                        background: '#FAF8F5',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                      Berat (kg) *
                    </label>
                    <input
                      type="number"
                      required
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="65"
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '12px 12px',
                        borderRadius: '12px',
                        border: '1px solid #E5E0D5',
                        background: '#FAF8F5',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
                      Sepatu (EUR)
                    </label>
                    <input
                      type="number"
                      value={shoeSize}
                      onChange={(e) => setShoeSize(e.target.value)}
                      placeholder="42"
                      style={{
                        width: '100%',
                        height: '48px',
                        padding: '12px 12px',
                        borderRadius: '12px',
                        border: '1px solid #E5E0D5',
                        background: '#FAF8F5',
                        fontSize: '14px',
                        color: 'var(--ink)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleNextFromStep1}
                style={{
                  width: '100%',
                  height: '52px',
                  borderRadius: '100px',
                  background: 'var(--ink)',
                  color: '#FFF',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  marginTop: '8px',
                  transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                }}
              >
                <span>Lanjut: Pilih Paket</span>
                <ArrowRight size={17} />
              </button>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* STEP 2: PILIH PAKET MEMBERSHIP                                         */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <h2 style={{ 
                  fontFamily: 'var(--font-display), "Fraunces", Georgia, serif', 
                  fontSize: '22px', 
                  fontWeight: 700, 
                  color: 'var(--ink)', 
                  margin: '0 0 4px 0',
                  lineHeight: 1.25
                }}>
                  Pilih Paket Keanggotaan
                </h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Pilih paket yang sesuai dengan kebutuhan riding Anda.
                </p>
              </div>

              {/* List of Plan Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const isGold = plan.name.toLowerCase().includes('gold');
                  const planDiscount = isRenewal ? (plan.extension_discount_idr || 0) : 0;
                  const effectivePrice = Math.max(0, plan.price_idr - planDiscount);
                  const benefits = isGold ? BENEFITS_BY_PLAN.gold : BENEFITS_BY_PLAN.silver;

                  const cardBg = isGold 
                    ? 'linear-gradient(145deg, #FDF9F1 0%, #F8EED9 50%, #EEDBB3 100%)' 
                    : 'linear-gradient(145deg, #FFFFFF 0%, #FBFBFB 50%, #F1F0EB 100%)';
                  
                  const border = isSelected 
                    ? `2px solid ${isGold ? '#C4A35D' : 'var(--ink)'}` 
                    : `1px solid ${isGold ? 'rgba(196, 163, 93, 0.35)' : 'rgba(0,0,0,0.09)'}`;

                  const cardShadow = isSelected
                    ? (isGold ? '0 10px 24px -4px rgba(185, 151, 79, 0.22)' : '0 10px 24px -4px rgba(0, 0, 0, 0.1)')
                    : '0 2px 8px rgba(0,0,0,0.02)';

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      style={{
                        background: cardBg,
                        border,
                        borderRadius: '20px',
                        padding: '22px 22px',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: cardShadow
                      }}
                    >
                      {/* Badge Top & Radio */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          letterSpacing: '0.8px',
                          color: isGold ? '#7D5F1A' : '#4A4A4A',
                          textTransform: 'uppercase'
                        }}>
                          {isGold ? '★ GOLD PACKAGE' : '★ SILVER PACKAGE'}
                        </span>

                        {/* Radio Check Circle */}
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? (isGold ? '#7D5F1A' : 'var(--ink)') : '#D0CBC0'}`,
                          background: isSelected ? (isGold ? '#7D5F1A' : 'var(--ink)') : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFF',
                          transition: 'all 0.15s ease'
                        }}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                      </div>

                      <div style={{ 
                        fontFamily: 'var(--font-display), "Fraunces", Georgia, serif',
                        fontSize: '22px', 
                        fontWeight: 700, 
                        color: 'var(--ink)', 
                        marginBottom: '8px',
                        lineHeight: 1.2
                      }}>
                        {plan.name}
                      </div>

                      {/* Sessions & Validity Pill */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          color: 'var(--ink)', 
                          background: 'rgba(255,255,255,0.85)', 
                          padding: '4px 10px', 
                          borderRadius: '100px',
                          border: '1px solid rgba(0,0,0,0.06)'
                        }}>
                          {plan.credits} Sesi Berkuda
                        </span>
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 600, 
                          color: 'var(--muted)', 
                          background: 'rgba(255,255,255,0.7)', 
                          padding: '4px 10px', 
                          borderRadius: '100px',
                          border: '1px solid rgba(0,0,0,0.04)'
                        }}>
                          Masa aktif {plan.duration_months} Bulan
                        </span>
                      </div>

                      {/* Price Section */}
                      <div style={{ 
                        marginBottom: '14px', 
                        paddingTop: '12px', 
                        borderTop: isGold ? '1px solid rgba(196, 163, 93, 0.25)' : '1px solid rgba(0,0,0,0.07)' 
                      }}>
                        {isRenewal && planDiscount > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', textDecoration: 'line-through', color: 'var(--muted)' }}>
                              Rp {plan.price_idr.toLocaleString('id-ID')}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '2px 8px', borderRadius: '100px' }}>
                              Hemat Rp {planDiscount.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                        <div style={{ fontSize: '26px', color: 'var(--ink)', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.15 }}>
                          Rp {effectivePrice.toLocaleString('id-ID')}
                        </div>
                      </div>

                      {/* Benefits Checklist */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                        {benefits.map((b, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.45 }}>
                            <CheckCircle2 size={16} color={isGold ? '#A67C26' : 'var(--ink)'} style={{ flexShrink: 0 }} />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    height: '52px',
                    padding: '0 24px',
                    borderRadius: '100px',
                    background: '#FFF',
                    border: '1px solid #E5E0D5',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                  }}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  style={{
                    flex: 1,
                    height: '52px',
                    borderRadius: '100px',
                    background: 'var(--ink)',
                    color: '#FFF',
                    fontSize: '14.5px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
                  }}
                >
                  <span>Lanjut: Pembayaran</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* STEP 3: PEMBAYARAN & UPLOAD BUKTI TRANSFER                            */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <h2 style={{ 
                  fontFamily: 'var(--font-display), "Fraunces", Georgia, serif', 
                  fontSize: '22px', 
                  fontWeight: 700, 
                  color: 'var(--ink)', 
                  margin: '0 0 4px 0',
                  lineHeight: 1.25
                }}>
                  Pembayaran & Bukti Transfer
                </h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Transfer sesuai nominal berikut lalu unggah bukti transfer.
                </p>
              </div>

              {/* Combined Payment & Bank Card - Spacious & Elegant */}
              <div style={{
                background: '#FFF',
                border: '1px solid #ECE7DC',
                borderRadius: '20px',
                padding: '22px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }}>
                {/* Order Summary Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Paket Dipilih
                    </div>
                    <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink)', marginTop: '3px' }}>
                      {selectedPlan.name} · {selectedPlan.credits} Sesi
                      {isRenewal && discount > 0 && (
                        <span style={{ fontSize: '11px', color: '#15803D', marginLeft: '6px', fontWeight: 700 }}>
                          (Hemat Rp {discount.toLocaleString('id-ID')})
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Total Pembayaran
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px', letterSpacing: '-0.2px' }}>
                      Rp {finalPrice.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: '#F0ECE1' }} />

                {/* Bank BCA Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={16} color="#8C6E2D" />
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '0.3px' }}>
                        TRANSFER BANK {bankName || 'BCA'}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', background: 'rgba(216, 188, 128, 0.22)', color: '#8C6E2D', padding: '3px 10px', borderRadius: '100px', fontWeight: 800, letterSpacing: '0.6px' }}>
                      OFFICIAL BBS
                    </span>
                  </div>

                  {/* Account Number Box */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#FAF8F5',
                    border: '1px solid #ECE7DC',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace', color: 'var(--ink)' }}>
                      {accountNumber || '1490011867027'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAccount}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: copied ? '#15803D' : 'var(--ink)',
                        color: '#FFF',
                        border: 'none',
                        height: '36px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    Atas Nama: <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{accountName || 'PT BERKAH BERKUDA SEJAHTERA'}</b>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone - Roomy, Native & Elegant */}
              <label style={{
                display: 'block',
                background: '#FAF8F5',
                border: '1.5px dashed #D5CEBE',
                borderRadius: '18px',
                padding: '20px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                position: 'relative'
              }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {!file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#F0EBE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Upload size={18} color="var(--ink)" />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
                        Unggah Bukti Pembayaran
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                        Ketuk untuk pilih foto atau PDF (Maks. 5MB)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      {previewUrl ? (
                        <div style={{ width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ECE7DC', flexShrink: 0 }}>
                          <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#F0EBE1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={18} color="var(--ink)" />
                        </div>
                      )}
                      <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '200px' }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 600, marginTop: '2px' }}>
                          {(file.size / 1024).toFixed(0)} KB · Siap dikirim
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFile();
                      }}
                      style={{
                        height: '34px',
                        padding: '0 14px',
                        borderRadius: '100px',
                        background: '#FEE2E2',
                        border: 'none',
                        color: '#B91C1C',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      <X size={12} />
                      <span>Ganti</span>
                    </button>
                  </div>
                )}
              </label>

              {errorMessage && (
                <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setStep(2)}
                  style={{
                    height: '52px',
                    padding: '0 24px',
                    borderRadius: '100px',
                    background: '#FFF',
                    border: '1px solid #E5E0D5',
                    color: 'var(--ink)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                  }}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !file}
                  onClick={handleSubmitAll}
                  style={{
                    flex: 1,
                    height: '52px',
                    borderRadius: '100px',
                    background: isSubmitting || !file ? '#C2BEB6' : 'var(--ink)',
                    color: '#FFF',
                    fontSize: '14.5px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: isSubmitting || !file ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: isSubmitting || !file ? 'none' : '0 4px 16px rgba(0,0,0,0.12)'
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} strokeWidth={2.5} />
                      <span>Kirim Pengajuan & Bukti</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {/* STEP 4: STATUS TAHAP REVIEW ADMIN (CLEAR & BEAUTIFUL CONFIRMATION)      */}
          {/* ═════════════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', paddingTop: '12px' }}
            >
              {/* Animated Glowing Badge / Icon */}
              <div style={{ position: 'relative', width: '76px', height: '76px', margin: '0 auto' }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(216, 188, 128, 0.3)',
                  filter: 'blur(10px)',
                }} />
                <div style={{
                  position: 'relative',
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FFF9ED 0%, #F5E8CC 100%)',
                  border: '1.5px solid #D8BC80',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#7D5F1A',
                  boxShadow: '0 6px 20px rgba(216, 188, 128, 0.25)'
                }}>
                  <Clock size={32} strokeWidth={2} />
                </div>
              </div>

              <div>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  padding: '5px 14px',
                  borderRadius: '100px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  display: 'inline-block',
                  marginBottom: '10px'
                }}>
                  SEDANG DALAM TAHAP REVIEW ADMIN
                </span>
                <h2 style={{ 
                  fontFamily: 'var(--font-display), "Fraunces", Georgia, serif', 
                  fontSize: '24px', 
                  fontWeight: 700, 
                  color: 'var(--ink)', 
                  margin: '0 0 8px 0',
                  lineHeight: 1.25
                }}>
                  Pengajuan Berhasil Dikirim!
                </h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', maxWidth: '380px', margin: '0 auto', lineHeight: 1.55 }}>
                  Bukti pembayaran dan data diri Anda telah kami terima. Admin BBS akan memverifikasi pembayaran Anda segera.
                </p>
              </div>

              {/* Summary Card - Roomy & Minimalist */}
              <div style={{
                background: '#FFF',
                border: '1px solid #ECE7DC',
                borderRadius: '20px',
                padding: '22px 22px',
                textAlign: 'left',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--muted)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  Rincian Pengajuan
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Kode Pengajuan</span>
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'monospace' }}>
                    {submittedData?.humanId || 'BBS-MEM-PENDING'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Paket Keanggotaan</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>
                    {submittedData?.planName || 'Membership BBS'}
                  </span>
                </div>

                {submittedData?.finalPriceIdr ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Total Pembayaran</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ink)' }}>
                      Rp {submittedData.finalPriceIdr.toLocaleString('id-ID')}
                    </span>
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Status Verifikasi</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '4px 10px', borderRadius: '8px' }}>
                    Menunggu Konfirmasi
                  </span>
                </div>

                <div style={{ height: '1px', background: '#F5F2EB', margin: '4px 0' }} />

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Sparkles size={16} color="#7D5F1A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                    Setelah dikonfirmasi, sesi dan hak istimewa membership akan aktif otomatis di akun Anda.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => router.push('/membership')}
                  style={{
                    width: '100%',
                    height: '52px',
                    borderRadius: '100px',
                    background: 'var(--ink)',
                    color: '#FFF',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
                  }}
                >
                  Lihat Status di Membership
                </button>

                <button
                  type="button"
                  onClick={handleContactAdmin}
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '100px',
                    background: '#FFF',
                    color: '#15803D',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    border: '1px solid #D5EAD8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <MessageCircle size={16} />
                  <span>Konfirmasi via WhatsApp Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/home')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px'
                  }}
                >
                  Kembali ke Beranda
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>

    </div>
  );
}
