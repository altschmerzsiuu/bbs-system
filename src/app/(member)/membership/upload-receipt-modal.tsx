'use client';
import React, { useState, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'framer-motion';
import { UploadReceiptForm } from './upload-receipt-form';

export function UploadReceiptModal(props: any) {
  const [isOpen, setIsOpen] = useState(false);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <div style={{ marginTop: '24px' }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '100px',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          }}
        >
          <span>Selesaikan Pembayaran</span>
          <ArrowRight size={18} />
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
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(4px)',
                zIndex: 9999,
              }}
            />

            {/* Bottom Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150 || info.velocity.y > 500) {
                  close();
                }
              }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: '#FDFBF7',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                padding: '24px',
                paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
                zIndex: 10000,
                y,
                opacity,
              }}
            >
              {/* Handle */}
              <div 
                onPointerDown={(e) => dragControls.start(e)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  paddingBottom: '24px',
                  cursor: 'grab',
                  touchAction: 'none'
                }}
              >
                <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }} />
              </div>

              {/* Header */}
              <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                <h2 style={{ font: '24px/1.2 var(--font-display)', margin: 0, color: 'var(--ink)' }}>Pembayaran</h2>
              </div>

              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <UploadReceiptForm {...props} onHideForm={() => close()} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
