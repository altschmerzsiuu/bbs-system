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
              className="primary" 
              style={{ width: '100%', height: '56px', fontSize: '15px' }}
            >
              {loading ? 'Connecting...' : 'Sign in as member'}
            </button>
            
            <a 
              href="https://wa.me/6282149981083?text=Halo%20Min!%20Aku%20mau%20tanya-tanya%20soal%20sesi%20riding%20casual%20dong,%20masih%20ada%20jadwal%20kosong%20nggak%20ya?%20%F0%9F%98%8A" 
              target="_blank"
              rel="noreferrer"
              className="primary" 
              style={{ width: '100%', height: '56px', fontSize: '15px', background: '#efeee9', color: 'var(--ink)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Book for casual ride
            </a>
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

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
