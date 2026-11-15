import type { Metadata, Viewport } from 'next';
import { Manrope, Fraunces } from 'next/font/google';
import './globals.css';
import '@/styles/tokens.css';
import { SerwistProvider } from "@serwist/turbopack/react";

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  style: ['normal', 'italic'],
  axes: ['opsz'],
});

export const metadata: Metadata = {
  title: 'Borneo Berkuda Stable',
  description: 'Borneo Berkuda Stable Management & Session Booking System',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { Toaster } from 'sonner';
import { NavigationProgress } from '@/components/ui/navigation-progress';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${manrope.variable} ${fraunces.variable}`}>
      <body suppressHydrationWarning={true}>
        <NavigationProgress />
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: '12px' } }} />
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
