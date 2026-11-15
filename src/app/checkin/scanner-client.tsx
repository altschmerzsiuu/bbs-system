'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, ChevronLeft, Loader2, RefreshCw, SwitchCamera } from 'lucide-react';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { lookupCheckinTokenAction } from './actions';

export function ScannerClient({ actorRole }: { actorRole: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  const backHref = actorRole === 'GROOMER' ? '/groomer' : '/admin';

  const handleResolveValue = (rawVal: string) => {
    startTransition(async () => {
      const res = await lookupCheckinTokenAction(rawVal);
      if (!res.ok || !res.token) {
        toast.custom((t) => (
          <AlertToast
            title="QR Tidak Dikenali"
            description={res.message || 'Pastikan QR yang di-scan adalah E-Ticket resmi Borneo Berkuda Stable.'}
            variant="destructive"
            onDismiss={() => toast.dismiss(t)}
          />
        ));
        // Restart scanner after brief delay if invalid QR
        setTimeout(() => setRetryKey((k) => k + 1), 1500);
        return;
      }
      router.push(`/checkin/${res.token}`);
    });
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let cancelled = false;

    const startScanner = async () => {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        if (!BarcodeDetectorCtor) {
          return;
        }

        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0 && codes[0].rawValue) {
                cancelled = true;
                stream?.getTracks().forEach((t) => t.stop());
                handleResolveValue(codes[0].rawValue);
                return;
              }
            }
          } catch {
            // Ignore frame decode errors
          }
          rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
      } catch (err: any) {
        setCameraError(
          'Izin kamera belum aktif atau browser memblokir akses kamera (gunakan localhost atau HTTPS, lalu izinkan akses kamera).'
        );
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, retryKey]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0E0E0D',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Fullscreen Camera Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
        }}
      />

      {/* Top Overlay Header */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 20px 12px',
          maxWidth: '480px',
          width: '100%',
          margin: '0 auto',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        <Link
          href={backHref}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.16)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          <ChevronLeft size={22} />
        </Link>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '1.6px',
              color: '#d7b56d',
              textTransform: 'uppercase',
            }}
          >
            Borneo Berkuda Stable
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '2px' }}>
            Scan QR E-Ticket
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
          aria-label="Ganti Kamera"
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.16)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <SwitchCamera size={19} />
        </button>
      </div>

      {/* Center QRIS-style Viewfinder Frame */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '264px',
            height: '264px',
            borderRadius: '28px',
            boxShadow: '0 0 0 9999px rgba(10, 10, 10, 0.58)',
          }}
        >
          {/* Corner Brackets */}
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              left: '-2px',
              width: '42px',
              height: '42px',
              borderTop: '4px solid #d7b56d',
              borderLeft: '4px solid #d7b56d',
              borderTopLeftRadius: '26px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '42px',
              height: '42px',
              borderTop: '4px solid #d7b56d',
              borderRight: '4px solid #d7b56d',
              borderTopRightRadius: '26px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              left: '-2px',
              width: '42px',
              height: '42px',
              borderBottom: '4px solid #d7b56d',
              borderLeft: '4px solid #d7b56d',
              borderBottomLeftRadius: '26px',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '42px',
              height: '42px',
              borderBottom: '4px solid #d7b56d',
              borderRight: '4px solid #d7b56d',
              borderBottomRightRadius: '26px',
            }}
          />

          {/* Animated Laser Scan Line */}
          {!cameraError && (
            <div
              style={{
                position: 'absolute',
                left: '16px',
                right: '16px',
                height: '2.5px',
                background: 'linear-gradient(90deg, transparent, #d7b56d, #fff, #d7b56d, transparent)',
                boxShadow: '0 0 12px 2px rgba(215, 181, 109, 0.85)',
                animation: 'bbsScanLaser 2.2s ease-in-out infinite',
              }}
            />
          )}

          {isPending && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                borderRadius: '26px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <Loader2 size={32} color="#d7b56d" className="animate-spin" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f3e6c6' }}>
                Memverifikasi E-Ticket...
              </span>
            </div>
          )}
        </div>

        {cameraError ? (
          <div
            style={{
              marginTop: '24px',
              maxWidth: '310px',
              background: 'rgba(24, 24, 23, 0.92)',
              border: '1px solid rgba(215, 181, 109, 0.4)',
              borderRadius: '18px',
              padding: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Camera size={24} color="#d7b56d" />
            <div style={{ fontSize: '12.5px', color: '#e5e5e0', lineHeight: 1.45 }}>
              {cameraError}
            </div>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: 'none',
                background: '#d7b56d',
                color: '#181817',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={13} />
              <span>Coba Buka Kamera Lagi</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: 'rgba(24, 24, 23, 0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#f3e6c6',
              textAlign: 'center',
            }}
          >
            Arahkan kotak ke QR Code E-Ticket Member / Tamu
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '16px 24px 34px',
          textAlign: 'center',
          fontSize: '11.5px',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        Otomatis memverifikasi kehadiran begitu QR terdeteksi
      </div>

      <style>{`
        @keyframes bbsScanLaser {
          0%, 100% { top: 18px; opacity: 0.85; }
          50% { top: 242px; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
