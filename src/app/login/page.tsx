'use client';

import React, { useState } from 'react';
import { createClient } from '@/infrastructure/supabase-browser';
import { Sparkles, ArrowRight, ShieldCheck, Compass, Mail, Lock, ChevronDown, ChevronUp } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memulai autentikasi Google.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Silakan lengkapi email dan password.');
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else {
        window.location.href = '/home';
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal masuk akun.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAF9F5] text-[#1C1A16] font-sans antialiased overflow-x-hidden">
      
      {/* ======================================================== */}
      {/* LEFT HALF (Full Screen Height on Desktop, Clean on Mobile) */}
      {/* ======================================================== */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-10 md:p-14 lg:p-16 xl:p-20 bg-[#FAF9F5]">
        
        {/* Top Branding Bar */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#1E2E1E] text-white flex items-center justify-center font-black text-xl tracking-wider shadow-md">
              BBS
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight text-[#1C1A16] leading-none">
                Borneo Berkuda Stable
              </div>
              <div className="text-[11px] font-semibold text-[#7A7569] mt-0.5 tracking-wider uppercase">
                Balikpapan · Equestrian Club
              </div>
            </div>
          </div>
        </div>

        {/* Center Content: Clean, Focused Login (No Clutter) */}
        <div className="my-auto py-10 max-w-md w-full mx-auto lg:mx-0">
          
          {/* Badge & Heading */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#EAE6DC] px-3.5 py-1 text-xs font-bold text-[#575246] mb-4">
              <Sparkles size={13} className="text-[#C9A24B]" />
              Member Portal & Sesi Berkuda
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[#1C1A16] tracking-tight leading-[1.15]">
              Selamat Datang di BBS
            </h1>
            <p className="mt-3 text-sm sm:text-base text-[#6E675C] leading-relaxed">
              Masuk dengan akun Google Anda untuk mengakses dashboard, jadwal sesi berkuda, dan kuota membership.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 rounded-2xl bg-[#FDEEED] border border-[#F8CBC8] p-3.5 text-xs font-semibold text-[#B54A4A]">
              {errorMessage}
            </div>
          )}

          {/* Primary Action: Google Sign In Button (Prominent & Clean) */}
          <div className="space-y-3.5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3.5 py-4 px-6 bg-white hover:bg-[#F2EFE9] active:scale-[0.99] text-[#1C1A16] font-bold text-base rounded-full border border-[#DFDAD0] shadow-sm transition duration-150 disabled:opacity-50"
            >
              <svg className="h-5 w-5 shrink-0" width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              {loading ? 'Menghubungkan ke Google...' : 'Lanjutkan dengan Google'}
            </button>

            {/* Secondary Action: Guest Access */}
            <a
              href="/schedule"
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 bg-[#EBE7DD] hover:bg-[#E3DFD4] active:scale-[0.99] text-[#3D3A33] font-semibold text-sm rounded-full transition"
            >
              <Compass size={16} />
              Lihat Jadwal & Sesi Tanpa Login (Tamu)
            </a>
          </div>

          {/* Collapsible Email Login Option (Untuk Admin atau Testing) */}
          <div className="mt-8 pt-4 border-t border-[#E8E3D8]">
            <button
              type="button"
              onClick={() => setShowEmailForm(!showEmailForm)}
              className="flex items-center justify-between w-full text-xs font-semibold text-[#8C8578] hover:text-[#1C1A16] transition"
            >
              <span>Atau masuk dengan email & password</span>
              {showEmailForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showEmailForm && (
              <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-[#8C8578]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#DDD8CD] rounded-xl text-xs text-[#1C1A16] focus:outline-none focus:ring-2 focus:ring-[#1E2E1E]"
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3.5 text-[#8C8578]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#DDD8CD] rounded-xl text-xs text-[#1C1A16] focus:outline-none focus:ring-2 focus:ring-[#1E2E1E]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#1E2E1E] text-white text-xs font-bold rounded-xl hover:bg-[#2A3F2A] transition"
                >
                  Masuk Akun
                </button>
              </form>
            )}
          </div>

          {/* Trust Notice */}
          <div className="mt-8 flex items-center gap-2 text-xs text-[#8C8578]">
            <ShieldCheck size={16} className="text-[#6B8E6B] shrink-0" />
            <span>Setiap akun Google baru otomatis terdaftar sebagai Member BBS.</span>
          </div>

        </div>

        {/* Footer Bar */}
        <div className="pt-6 border-t border-[#EAE5DC] flex flex-col sm:flex-row justify-between items-center text-xs text-[#8C8578] gap-2">
          <div>© 2026 Borneo Berkuda Stable</div>
          <div className="flex gap-4">
            <a href="https://wa.me/6282149981083" target="_blank" rel="noreferrer" className="hover:underline">
              Bantuan WhatsApp Admin
            </a>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* RIGHT HALF (Desktop Showcase: Full Screen Bleed Edge)   */}
      {/* ======================================================== */}
      <div className="hidden lg:block lg:w-1/2 min-h-screen relative overflow-hidden bg-[#141A12]">
        
        {/* Video or High-Resolution Equestrian Showcase Image */}
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/images/horse-riding-showcase.jpg"
          className="absolute inset-0 h-full w-full object-cover object-center brightness-[0.8] contrast-[1.05]"
        >
          <source src="/videos/horse-riding.mp4" type="video/mp4" />
        </video>

        {/* Gradient Overlay for Editorial Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40 pointer-events-none" />

        {/* Floating Top Pill */}
        <div className="absolute top-10 left-10 right-10 z-10 flex items-center justify-between pointer-events-none">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-4 py-2 text-xs font-bold text-white border border-white/20">
            <Sparkles size={14} className="text-[#E7C76F]" /> Borneo Berkuda Stable
          </div>
          <div className="text-xs font-semibold text-white/90 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
            Balikpapan · WITA
          </div>
        </div>

        {/* Bottom Hero & Editorial Showcase (Style Gambar 2) */}
        <div className="absolute bottom-12 left-10 right-10 z-10 max-w-lg text-white">
          <div className="inline-block rounded-full bg-[#8AD65E] text-[#0F1D0A] text-xs font-black uppercase px-3.5 py-1 tracking-wider mb-4 shadow-lg">
            Equestrian Excellence
          </div>
          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-black tracking-tight leading-[1.12] text-white">
            Discover Harmony, Balance & Grace in Every Ride
          </h2>
          <p className="mt-3 text-sm xl:text-base text-white/85 leading-relaxed font-normal">
            Fasilitas arena berstandar, instruktur berpengalaman, serta sistem booking sesi real-time yang dirancang khusus untuk kenyamanan para rider.
          </p>

          <div className="mt-6 flex items-center gap-4 pt-4 border-t border-white/20">
            <div className="flex -space-x-2">
              <div className="h-9 w-9 rounded-full border-2 border-white/70 bg-[#C9A24B] flex items-center justify-center font-black text-xs text-white shadow-md">
                G
              </div>
              <div className="h-9 w-9 rounded-full border-2 border-white/70 bg-[#7E9A7A] flex items-center justify-center font-black text-xs text-white shadow-md">
                S
              </div>
            </div>
            <div className="text-xs text-white/95">
              Tersedia paket membership <strong className="font-bold">Gold (10 Sesi)</strong> & <strong className="font-bold">Silver (5 Sesi)</strong>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
