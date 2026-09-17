'use client';
import React from 'react';

export default function OfflinePage() {
  return (
    <div className="min-h-dvh bg-bg text-ink flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 mb-6 opacity-60">
        <img 
          src="/icons/icon-192.png" 
          alt="BBS Logo" 
          className="w-full h-full object-contain filter grayscale"
        />
      </div>
      <h1 className="text-2xl font-bold mb-2">Anda Sedang Offline</h1>
      <p className="text-ink-2 max-w-sm mb-8">
        Borneo Berkuda Stable saat ini tidak dapat terhubung ke server. 
        Silakan periksa koneksi internet Anda dan coba muat ulang halaman.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="btn gold"
      >
        Coba Lagi
      </button>
    </div>
  );
}
