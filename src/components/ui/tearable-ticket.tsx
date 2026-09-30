'use client';

import React, { useEffect, useRef, useState } from 'react';

interface TearableTicketProps {
  topContent: React.ReactNode;
  bottomContent: React.ReactNode;
  stubContent?: React.ReactNode;
  onTearComplete?: () => void;
}

export function TearableTicket({ topContent, bottomContent, stubContent, onTearComplete }: TearableTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const tearLineRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const [clipPathTop, setClipPathTop] = useState('');
  const [clipPathBottom, setClipPathBottom] = useState('');
  
  const [dragging, setDragging] = useState(false);
  const [torn, setTorn] = useState(false);
  const [settled, setSettled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [nearly, setNearly] = useState(false);

  // Generate jagged teeth
  useEffect(() => {
    const buildTeeth = (n: number) => {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = (i / n * 100).toFixed(2);
        const r = Math.random();
        const depth = (5 + r * 9).toFixed(1); // 5–14px jagged depth
        pts.push({ x, depth, peak: i % 2 === 1 });
      }
      return pts;
    };
    const teeth = buildTeeth(12);
    const topClip = 'polygon(0% 0%, 100% 0%, ' + teeth.slice().reverse().map(p => p.x + '% ' + (p.peak ? `calc(100% - ${p.depth}px)` : '100%')).join(', ') + ')';
    const bottomClip = 'polygon(0% 100%, ' + teeth.map(p => p.x + '% ' + (p.peak ? `${p.depth}px` : '0%')).join(', ') + ', 100% 100%)';
    
    setClipPathTop(topClip);
    setClipPathBottom(bottomClip);
  }, []);

  // Pointer events logic
  useEffect(() => {
    // DISABLING ANIMATION TEMPORARILY
    return;
    
    const tearLine = tearLineRef.current;
    if (!tearLine || torn) return;

    let isDragging = false;
    let startX = 0;
    let lastProgress = 0;
    const THRESHOLD = 0.62;

    const updateProgress = (p: number) => {
      p = Math.max(0, Math.min(1, p));
      setProgress(p);
      lastProgress = p;

      if (p > 0.78 && !nearly) {
        setNearly(true);
        setTimeout(() => setNearly(false), 380);
      }
    };

    const finishTear = () => {
      if (torn) return;
      isDragging = false;
      setDragging(false);
      setTorn(true);
      updateProgress(1);

      // Settle sequence after animation
      setTimeout(() => {
        if (mainRef.current && topRef.current) {
          const mainH = mainRef.current.getBoundingClientRect().height;
          const topH = topRef.current.getBoundingClientRect().height;
          
          mainRef.current.style.overflow = 'hidden';
          mainRef.current.style.maxHeight = mainH + 'px';
          // trigger reflow
          void mainRef.current.offsetHeight;
          
          requestAnimationFrame(() => {
            if (mainRef.current) {
              mainRef.current.style.transition = 'max-height 0.48s cubic-bezier(0.4, 0, 0.7, 1)';
              mainRef.current.style.maxHeight = topH + 'px';
            }
            setSettled(true);
            onTearComplete?.();
          });
        }
      }, 610);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (torn) return;
      isDragging = true;
      startX = e.clientX;
      tearLine?.setPointerCapture(e.pointerId);
      setDragging(true);
      updateProgress(lastProgress);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || torn) return;
      const dx = e.clientX - startX;
      const width = ticketRef.current?.offsetWidth || 300;
      const p = Math.min(1, Math.abs(dx) / (width * 0.52));

      // Slight resistance near the beginning
      const eased = p < 0.15 ? p * 0.72 : 0.108 + (p - 0.15) * 1.05;
      updateProgress(Math.min(1, eased));

      if (lastProgress >= THRESHOLD) {
        finishTear();
      }
    };

    const onPointerUp = () => {
      if (!isDragging || torn) return;
      isDragging = false;
      setDragging(false);

      if (lastProgress >= THRESHOLD) {
        finishTear();
      } else {
        updateProgress(0);
      }
    };

    tearLine?.addEventListener('pointerdown', onPointerDown);
    tearLine?.addEventListener('pointermove', onPointerMove);
    tearLine?.addEventListener('pointerup', onPointerUp);
    tearLine?.addEventListener('pointercancel', onPointerUp);

    return () => {
      tearLine?.removeEventListener('pointerdown', onPointerDown);
      tearLine?.removeEventListener('pointermove', onPointerMove);
      tearLine?.removeEventListener('pointerup', onPointerUp);
      tearLine?.removeEventListener('pointercancel', onPointerUp);
    };
  }, [torn, onTearComplete, nearly]);

  return (
    <>
      <style>{`
        .tear-ticket-wrap {
          --progress: ${progress};
          position: relative;
          display: flex;
          border-radius: 22px;
          box-shadow: 0 12px 30px rgba(35, 31, 22, 0.1);
          border: 1px solid #efeade;
          overflow: hidden;
        }
        .tear-ticket-wrap.dragging, .tear-ticket-wrap.torn {
          overflow: visible;
        }
        .tear-ticket-main {
          flex: 1;
          background: #f9f6ef;
          position: relative;
          overflow: hidden;
        }
        .tear-ticket-wrap.dragging .tear-ticket-main, .tear-ticket-wrap.torn .tear-ticket-main {
          overflow: visible;
        }
        .tear-piece {
          position: relative;
          z-index: 1;
          background: #f9f6ef;
          transition: transform 0.45s cubic-bezier(0.22, 1.6, 0.4, 1), filter 0.45s ease;
          will-change: transform;
        }
        .tear-ticket-wrap.dragging .tear-piece {
          transition: none;
        }
        .tear-piece-top {
          border-radius: 22px 0 0 0;
          padding-top: 0;
          transform: rotate(calc(var(--progress) * -8deg)) translate(calc(var(--progress) * -12px), calc(var(--progress) * -16px));
          filter: drop-shadow(0 calc(1px + var(--progress) * 13px) calc(2px + var(--progress) * 18px) rgba(20, 17, 10, calc(0.14 + var(--progress) * 0.2)));
        }
        .tear-piece-bottom {
          border-radius: 0 0 0 22px;
          transform: rotate(calc(var(--progress) * 6deg)) translate(calc(var(--progress) * 9px), calc(var(--progress) * 14px));
          filter: drop-shadow(0 calc(1px + var(--progress) * 11px) calc(2px + var(--progress) * 16px) rgba(20, 17, 10, calc(0.12 + var(--progress) * 0.16)));
        }
        .tear-ticket-wrap.settled .tear-piece-bottom {
          opacity: 0;
          transform: rotate(9deg) translate(26px, 40px) scale(0.94);
          transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.4, 0, 0.7, 1);
        }
        .tear-ticket-wrap.settled .tear-piece-top {
          transform: rotate(-1.5deg) translate(-3px, -2px);
          filter: drop-shadow(0 6px 14px rgba(20, 17, 10, 0.16));
        }
        .tear-ticket-wrap.settled .stub {
          opacity: 0;
          width: 0;
          transition: opacity 0.4s ease, width 0.4s cubic-bezier(0.4, 0, 0.7, 1);
        }
        .stub {
          width: 44px;
          background: #f2ede0;
          border-left: 2px dashed #ddd5c4;
          border-radius: 0 22px 22px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .stub span {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #a89b7a;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .tear-line {
          position: relative;
          height: 34px;
          margin: -6px 0;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3;
          touch-action: none;
          user-select: none;
          transition: opacity 0.2s ease;
        }
        .tear-line:active {
          cursor: grabbing;
        }
        .tear-line:before {
          content: "";
          position: absolute;
          left: 22px;
          right: 22px;
          top: 50%;
          border-top: 2px dashed #ddd5c4;
          pointer-events: none;
        }
        .tear-ticket-wrap.torn .tear-line {
          display: none;
        }
        .tear-hint {
          position: relative;
          background: #f9f6ef;
          padding: 0 9px;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #a89b7a;
          display: flex;
          align-items: center;
          gap: 6px;
          animation: tearPulse 2.2s ease-in-out infinite;
          pointer-events: none;
          transition: opacity 0.25s ease;
        }
        .tear-ticket-wrap.active .tear-hint {
          opacity: 0;
        }
        .tear-grip {
          position: relative;
          display: flex;
          gap: 3px;
          pointer-events: none;
        }
        .tear-grip i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #c9bfa4;
        }
        @keyframes tearPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      <div 
        ref={ticketRef} 
        className={`tear-ticket-wrap ${dragging ? 'dragging' : ''} ${torn ? 'torn' : ''} ${settled ? 'settled' : ''} ${progress > 0.025 ? 'active' : ''} ${nearly ? 'nearly' : ''}`}
      >
        <div className="tear-ticket-main" ref={mainRef}>
          {/* Top Piece */}
          <div 
            ref={topRef}
            className="tear-piece tear-piece-top" 
            style={{ clipPath: clipPathTop, padding: '22px 22px 20px' }}
          >
            {topContent}
          </div>

          {/* Tear Line / Handler */}
          <div className="tear-line" ref={tearLineRef} aria-label="Press, hold and slide to tear the ticket">
            <span className="tear-hint">
              <span className="tear-grip"><i></i><i></i><i></i></span>
              hold & pull to tear
              <span className="tear-grip"><i></i><i></i><i></i></span>
            </span>
          </div>

          {/* Bottom Piece */}
          <div 
            className="tear-piece tear-piece-bottom" 
            style={{ clipPath: clipPathBottom, padding: '18px 22px 22px' }}
          >
            {bottomContent}
          </div>
        </div>

        {/* Stub Piece */}
        {stubContent && (
          <div className="stub">
            {stubContent}
          </div>
        )}
      </div>
    </>
  );
}
