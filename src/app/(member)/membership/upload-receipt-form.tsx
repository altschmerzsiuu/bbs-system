'use client';

import React, { useState } from 'react';
import { Upload, FileText, X, Loader2, Copy, Check } from 'lucide-react';
import { uploadPaymentReceiptAction } from './actions';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';

interface UploadReceiptFormProps {
  applicationId: string;
  finalPriceIdr: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  rejectionReason?: string;
  onHideForm?: () => void;
}

export function UploadReceiptForm({
  applicationId,
  finalPriceIdr,
  bankName,
  accountNumber,
  accountName,
  rejectionReason,
  onHideForm
}: UploadReceiptFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    toast.success('Nomor rekening disalin!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.custom((t) => <AlertToast title="Gagal" description="Silakan pilih file bukti transfer" variant="destructive" onDismiss={() => toast.dismiss(t)} />);
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('receipt', file);

    const res = await uploadPaymentReceiptAction(applicationId, formData);
    setIsSubmitting(false);

    if (res.ok) {
      toast.custom((t) => <AlertToast title="Berhasil" description="Bukti pembayaran berhasil diupload!" onDismiss={() => toast.dismiss(t)} />);
      setFile(null);
      if (onHideForm) onHideForm();
    } else {
      toast.custom((t) => <AlertToast title="Gagal" description={res.message} variant="destructive" onDismiss={() => toast.dismiss(t)} />);
    }
  };

  return (
    <div style={{ padding: '0', background: 'transparent' }}>
      
      {rejectionReason && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', borderRadius: '12px', fontSize: '13px', marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <b style={{ display: 'block', marginBottom: '4px' }}>Bukti sebelumnya ditolak:</b>
          {rejectionReason}
        </div>
      )}

      <div style={{ background: '#FFF', borderRadius: '12px', padding: '16px', border: '1px solid var(--line)', marginBottom: '16px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Total Tagihan</div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)', marginBottom: '16px' }}>
          Rp {finalPriceIdr.toLocaleString('id-ID')}
        </div>
        
        <div style={{ height: '1px', background: 'var(--line)', margin: '0 -16px 16px -16px' }}></div>
        
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Transfer ke:</div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)' }}>{bankName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '1px' }}>{accountNumber}</div>
          <button 
            onClick={handleCopy}
            type="button"
            style={{ 
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: copied ? '#10b981' : 'var(--muted)',
              transition: 'color 0.2s'
            }}
            title="Copy Account Number"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>a.n. {accountName}</div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Upload Bukti Transfer</div>
        
        {!file ? (
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', border: '2px dashed var(--line)', borderRadius: '12px', cursor: 'pointer', background: '#FFF' }}>
            <Upload size={24} color="var(--muted)" style={{ marginBottom: '8px' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>Pilih file atau foto</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>JPG, PNG, PDF max 5MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
          </label>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFF', border: '1px solid var(--line)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <FileText size={20} color="var(--gold)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name}
              </div>
            </div>
            <button 
              onClick={() => setFile(null)}
              style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={isSubmitting || !file}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          background: (isSubmitting || !file) ? 'var(--line)' : 'var(--ink)',
          color: (isSubmitting || !file) ? 'var(--muted)' : '#FFF',
          border: 'none',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          cursor: (isSubmitting || !file) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {isSubmitting ? 'Mengupload...' : 'Kirim Bukti Pembayaran'}
      </button>
    </div>
  );
}
