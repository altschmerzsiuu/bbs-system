'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/infrastructure/supabase-browser';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertToast } from '@/components/ui/alert-toast';
import { Calendar, Ticket, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1200);

    const params = new URLSearchParams(window.location.search);
    const err = params.get('msg') || params.get('error');
    if (err) {
      const message =
        params.get('msg') ||
        (err === 'exchange_failed'
          ? 'Gagal menukar token sesi login Google. Periksa Authorized Redirect URI di Google Console / Supabase.'
          : err);
      toast.custom((t) => (
        <AlertToast
          title="Login Gagal"
          description={message}
          variant="destructive"
          onDismiss={() => toast.dismiss(t)}
        />
      ));
      window.history.replaceState({}, '', window.location.pathname);
    }

    return () => clearTimeout(timer);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div
      suppressHydrationWarning
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Main Content ── */}
      <div
        suppressHydrationWarning
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          opacity: showSplash ? 0 : 1,
          transition: 'opacity 220ms ease-out',
          pointerEvents: showSplash ? 'none' : 'auto',
        }}
      >
        {/* Top Hero: Real Photography + Dark Contrast Overlay */}
        <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '280px' }}>
          <Image
            src="/images/horse-4.png"
            alt="Borneo Berkuda Stable"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(18,18,16,0.35) 0%, rgba(18,18,16,0.15) 45%, rgba(18,18,16,0.82) 100%)',
            }}
          />
          {/* Brand Pill with Selective Gold Dot */}
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--r-md)',
              background: 'rgba(18, 18, 16, 0.78)',
              color: 'var(--surface)',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.6px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--gold)',
              }}
            />
            <span>BORNEO BERKUDA STABLE</span>
          </div>
        </div>

        {/* Overlapping Card */}
        <div
          style={{
            background: 'var(--surface)',
            borderTopLeftRadius: 'var(--r-xl)',
            borderTopRightRadius: 'var(--r-xl)',
            padding: '32px 24px calc(28px + env(safe-area-inset-bottom, 0px))',
            marginTop: '-28px',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <h1
            style={{
              font: '800 28px/1.15 var(--font-body, sans-serif)',
              margin: '0 0 8px 0',
              color: 'var(--ink)',
              letterSpacing: '-0.5px',
            }}
          >
            Jadwal & Reservasi Berkuda
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              margin: '0 0 24px 0',
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            Masuk dengan akun Member, atau pesan sesi Fun Ride & Joy Ride langsung tanpa akun.
          </p>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 1. Single Dominant Primary Action */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              suppressHydrationWarning
              className="bbs-btn-primary"
              style={{ width: '100%' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{loading ? 'Menghubungkan...' : 'Masuk Member (Google)'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--muted)',
                  fontWeight: 700,
                }}
              >
                Tamu / Non-Member
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* 2. Clearly Secondary Action: Direct Link to /ride */}
            <Link
              href="/ride"
              className="bbs-btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                border: '1.5px solid var(--gold-accent)',
                background: 'var(--surface-subtle)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} strokeWidth={2} color="var(--gold-accent)" />
                <span>Pesan Fun Ride / Casual</span>
              </span>
              <ArrowRight size={18} strokeWidth={2} color="var(--gold-ink)" />
            </Link>

            {/* 3. Tertiary Action: Visually Distinct Clickable Link for Ticket Check */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '44px',
                flexWrap: 'wrap',
                marginTop: '2px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
                Sudah pesan tiket?
              </span>
              <Link
                href="/ride?tab=check"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  background: 'var(--gold-soft)',
                  border: '1px solid var(--gold-accent)',
                  color: 'var(--gold-ink)',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                <Ticket size={14} strokeWidth={2} color="var(--gold-ink)" />
                <span>Cek Status & E-Ticket Saya</span>
                <ArrowRight size={14} strokeWidth={2} color="var(--gold-ink)" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Splash Screen ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showSplash ? 1 : 0,
          transition: 'opacity 220ms ease-out',
          pointerEvents: showSplash ? 'auto' : 'none',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '160px', height: '160px' }}>
            <Image
              src="/brand/bbs-logo-source.jpg"
              alt="BBS Logo"
              fill
              sizes="160px"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
        <div
          style={{
            paddingBottom: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--gold)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '12px',
              letterSpacing: '1.6px',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              fontWeight: 800,
            }}
          >
            Borneo Berkuda Stable
          </span>
        </div>
      </div>
    </div>
  );
}
