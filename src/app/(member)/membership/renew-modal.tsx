'use client';
import React, { useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'framer-motion';

export function RenewModal({ plans, activeMembership }: { plans: any[], activeMembership: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <div style={{ marginTop: '32px' }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%',
            padding: '20px 24px',
            borderRadius: '100px',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          }}
        >
          <span>{activeMembership ? 'Renew Membership' : 'Join Membership'}</span>
          <ArrowRight size={20} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={close}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100,
                background: 'rgba(0,0,0,0.45)',
              }}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) {
                  close();
                } else {
                  y.set(0);
                }
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                y,
                opacity,
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 101,
                background: '#fff',
                borderRadius: '28px 28px 0 0',
                maxHeight: '88vh',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                touchAction: 'none',
              }}
            >
              {/* Drag handle */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                style={{ padding: '16px 0 8px', display: 'flex', justifyContent: 'center', cursor: 'grab', userSelect: 'none' }}
              >
                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e0ddd7' }} />
              </div>

              <div style={{ padding: '8px 24px 48px' }}>
                <h2 style={{ font: '28px var(--font-display)', margin: '0 0 6px 0', color: 'var(--ink)' }}>
                  {activeMembership ? 'Renew / Upgrade' : 'Available Plans'}
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 24px' }}>
                  Choose a plan that fits your riding goals.
                </p>

                {(plans ?? []).map((plan: any) => {
                  const planNameLower = plan.name.toLowerCase();
                  let eyebrowColor = 'var(--muted)';
                  let cardBg = '#fff';
                  let cardTextColor = 'var(--ink)';

                  if (planNameLower.includes('gold')) {
                    eyebrowColor = '#5a4214';
                    cardBg = 'linear-gradient(135deg, #f3e9d2, #d1a85b)';
                  } else if (planNameLower.includes('silver')) {
                    eyebrowColor = '#333';
                    cardBg = 'linear-gradient(135deg, #f5f5f5, #b8b8b8)';
                  }

                  return (
                    <div key={plan.id} style={{ background: cardBg, border: 'none', borderRadius: '24px', padding: '24px', marginBottom: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: eyebrowColor }}>
                        {plan.name.toUpperCase()}
                      </span>
                      <div style={{ font: '32px var(--font-display)', color: cardTextColor, margin: '4px 0 8px' }}>
                        {plan.credits} sessions
                      </div>
                      <div style={{ fontSize: '14px', color: cardTextColor, opacity: 0.8, fontWeight: 500 }}>
                        {plan.duration_months} months · Rp {(plan.price_idr / 1000).toLocaleString('id-ID')}k
                      </div>

                      {activeMembership ? (
                        <a
                          href={`/request?type=membership`}
                          style={{ textDecoration: 'none', display: 'block', marginTop: '24px' }}
                        >
                          <button style={{ width: '100%', padding: '16px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                            Renew with {plan.name}
                          </button>
                        </a>
                      ) : (
                        <a href="/request?type=membership" style={{ textDecoration: 'none', display: 'block', marginTop: '24px' }}>
                          <button style={{ width: '100%', padding: '16px', borderRadius: '100px', background: 'var(--ink)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                            Join {plan.name}
                          </button>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
