'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * NavigationProgress — renders a slim top progress bar during page transitions.
 * Uses CSS View Transitions when available for a crossfade effect.
 * Adds hover-based prefetching for internal links.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const startProgress = useCallback(() => {
    const bar = barRef.current;
    if (!bar || activeRef.current) return;
    activeRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    let pct = 0;
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.style.opacity = '1';

    const tick = () => {
      const inc = pct < 20 ? 12 : pct < 50 ? 6 : pct < 75 ? 2.5 : pct < 88 ? 0.8 : 0.2;
      pct = Math.min(pct + inc, 90);
      bar.style.transition = 'width 0.25s ease';
      bar.style.width = `${pct}%`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const finishProgress = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    bar.style.transition = 'width 0.12s ease';
    bar.style.width = '100%';
    timerRef.current = setTimeout(() => {
      if (bar) {
        bar.style.transition = 'opacity 0.25s ease';
        bar.style.opacity = '0';
      }
    }, 180);
  }, []);

  // Finish on route change
  useEffect(() => {
    finishProgress();
  }, [pathname, finishProgress]);

  // Intercept link clicks to start progress immediately
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel') || href.startsWith('javascript')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      startProgress();
    };
    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [startProgress]);

  // Intercept button clicks that trigger router.push (via data-href attribute convention)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element)?.closest('[data-navigate]') as HTMLElement | null;
      if (btn) startProgress();
    };
    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [startProgress]);

  // View Transitions API — smooth crossfade between pages
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!('startViewTransition' in document)) return;

    const style = document.createElement('style');
    style.setAttribute('data-bbs-vt', '');
    style.textContent = `
      @media (prefers-reduced-motion: no-preference) {
        ::view-transition-old(root) {
          animation: bbs-vt-out 0.15s ease both;
        }
        ::view-transition-new(root) {
          animation: bbs-vt-in 0.2s ease both;
        }
        @keyframes bbs-vt-out {
          to { opacity: 0; transform: scale(0.985); }
        }
        @keyframes bbs-vt-in {
          from { opacity: 0; transform: scale(1.01); }
        }
      }
    `;
    if (!document.querySelector('[data-bbs-vt]')) {
      document.head.appendChild(style);
    }
  }, []);

  // Hover prefetch for internal links
  useEffect(() => {
    const prefetched = new Set<string>();
    const onMouseEnter = (e: MouseEvent) => {
      const link = (e.target as Element)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || prefetched.has(href)) return;
      prefetched.add(href);
      try { router.prefetch(href); } catch {}
    };
    document.addEventListener('mouseover', onMouseEnter, { passive: true });
    return () => document.removeEventListener('mouseover', onMouseEnter);
  }, [router]);

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '3px',
        width: '0%',
        opacity: 0,
        zIndex: 9999,
        pointerEvents: 'none',
        background: 'linear-gradient(90deg, #b9974f, #e8c87a, #b9974f)',
        backgroundSize: '200% 100%',
        borderRadius: '0 3px 3px 0',
        boxShadow: '0 0 10px rgba(185,151,79,0.5)',
        willChange: 'width, opacity',
      }}
    />
  );
}
