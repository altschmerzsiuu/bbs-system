import React from 'react';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'line' | 'dark' | 'gold' }) {
  return (
    <button className={`btn ${variant} press ${className}`} {...props}>
      {children}
    </button>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={`pill ${status.toLowerCase()}`}>{label || status}</span>;
}
