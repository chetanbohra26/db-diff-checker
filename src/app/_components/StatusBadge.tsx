import type { DiffSeverity } from '@/lib/types/diff';

interface StatusBadgeProps {
  severity: DiffSeverity;
  count: number;
  label: string;
}

const SEVERITY_STYLES: Record<DiffSeverity, string> = {
  error:   'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5',
  warning: 'background:#fef9c3;color:#854d0e;border:1px solid #fde047',
  info:    'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd',
};

export function StatusBadge({ severity, count, label }: StatusBadgeProps) {
  return (
    <span style={{
      ...parseStyle(SEVERITY_STYLES[severity]),
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: 600,
    }}>
      {count} {label}
    </span>
  );
}

// Minimal inline style parser for the static style strings above
function parseStyle(s: string): React.CSSProperties {
  return Object.fromEntries(
    s.split(';').filter(Boolean).map((rule) => {
      const [k, v] = rule.split(':').map((x) => x.trim());
      const camel = k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      return [camel, v];
    })
  ) as React.CSSProperties;
}
