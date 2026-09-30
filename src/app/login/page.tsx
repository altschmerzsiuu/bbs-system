'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/infrastructure/supabase-browser';
import Image from 'next/image';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
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
    } catch (err: any) {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Landing Page Content ── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          opacity: showSplash ? 0 : 1,
          transition: 'opacity 0.6s ease-in-out',
          pointerEvents: showSplash ? 'none' : 'auto'
        }}
      >
        {/* Top Half: Image */}
        <div style={{ flex: 1, position: 'relative', width: '100%' }}>
          <Image
            src="/images/horse-4.png" // Menggunakan salah satu aset kuda
            alt="BBS Horse"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
          />
        </div>

        {/* Bottom Half: White Panel with Rounded Corners */}
        <div style={{
          background: 'var(--white)',
          borderTopLeftRadius: '32px',
          borderTopRightRadius: '32px',
          padding: '40px 24px',
          marginTop: '-24px', // Pull up to overlap image slightly
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.1)' // slight shadow for depth
        }}>
          <h1 style={{ font: '32px var(--font-display)', margin: '0 0 12px 0', color: 'var(--ink)' }}>
            More Than a Ride.
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 32px 0', lineHeight: 1.5, maxWidth: '280px' }}>
            Horses teach us patience, presence, and a kinder strength.
          </p>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{ width: '100%', height: '56px', fontSize: '15px', background: 'var(--ink)', color: 'var(--white)', border: 'none', borderRadius: '16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Splash Screen (on top) ── */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: '#ffffff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          opacity: showSplash ? 1 : 0,
          transition: 'opacity 0.6s ease-in-out',
          pointerEvents: showSplash ? 'auto' : 'none'
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '180px', height: '180px' }}>
            <Image
              src="/brand/bbs-logo-source.jpg"
              alt="BBS Logo"
              fill
              sizes="(max-width: 768px) 180px, 180px"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
        <div style={{ paddingBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 1.5s infinite' }}></div>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 1.5s infinite 0.2s' }}></div>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold)', animation: 'pulse 1.5s infinite 0.4s' }}></div>
          </div>
          <span style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Borneo Berkuda</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
