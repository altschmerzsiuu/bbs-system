import { InfoIcon, AlertCircle } from "lucide-react";
import React from 'react';

export function AlertToast({ 
  title, 
  description, 
  variant = 'default', 
  onDismiss 
}: { 
  title: string, 
  description: string, 
  variant?: 'default' | 'destructive', 
  onDismiss?: () => void 
}) {
  return (
    <div style={{
      display: 'flex', 
      gap: '14px', 
      padding: '16px 20px', 
      background: '#FFF', 
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.05)', 
      border: '1px solid rgba(0,0,0,0.06)', 
      width: '100%', 
      maxWidth: '380px',
      alignItems: 'flex-start'
    }}>
      <div style={{ color: variant === 'destructive' ? '#EF4444' : '#10B981', marginTop: '2px' }}>
        {variant === 'destructive' ? <AlertCircle size={24} /> : <InfoIcon size={24} />}
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#111827' }}>
          {title}
        </h4>
        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: 1.4 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
