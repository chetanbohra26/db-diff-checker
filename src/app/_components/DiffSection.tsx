'use client';

import { useState } from 'react';
import type { DiffSeverity } from '@/lib/types/diff';

interface DiffSectionProps {
  title: string;
  count: number;
  severity: DiffSeverity;
  children: React.ReactNode;
}

const SEVERITY_COLOR: Record<DiffSeverity, string> = {
  error:   '#dc2626',
  warning: '#d97706',
  info:    '#2563eb',
};

export function DiffSection({ title, count, severity, children }: DiffSectionProps) {
  const [open, setOpen] = useState(true);

  if (count === 0) return null;

  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#f9fafb',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: SEVERITY_COLOR[severity],
            flexShrink: 0,
          }} />
          {title}
          <span style={{
            background: SEVERITY_COLOR[severity],
            color: '#fff',
            borderRadius: '9999px',
            padding: '0 8px',
            fontSize: '12px',
            fontWeight: 700,
          }}>
            {count}
          </span>
        </span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 12px', fontSize: '13px', fontFamily: 'monospace' }}>
          {children}
        </div>
      )}
    </div>
  );
}
