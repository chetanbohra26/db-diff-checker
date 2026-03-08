'use client';

import { useState } from 'react';
import type { ConnectionConfig } from '@/lib/types/connection';
import type { CompareOptions } from '@/lib/api/compareSchema';
import { DiffResults } from './DiffResults';
import type { DiffResult } from '@/lib/types/diff';

type PartialConn = Partial<ConnectionConfig>;

const DEFAULT_PORTS: Record<string, number> = { mysql: 3306, postgres: 5432 };

function emptyConn(): PartialConn {
  return { driver: 'mysql', host: 'localhost', port: 3306 };
}

interface ApiResponse {
  success: boolean;
  result?: DiffResult;
  durationMs?: number;
  error?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
      <span style={{ fontWeight: 500, color: '#374151' }}>{label}</span>
      {children}
    </label>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
};

function ConnPanel({
  title,
  conn,
  onChange,
}: {
  title: string;
  conn: PartialConn;
  onChange: (c: PartialConn) => void;
}) {
  function set(key: keyof ConnectionConfig, value: string | number) {
    onChange({ ...conn, [key]: value });
  }

  function handleDriverChange(driver: 'mysql' | 'postgres') {
    onChange({ ...conn, driver, port: DEFAULT_PORTS[driver] });
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{title}</h3>

      <Field label="Database Type">
        <select
          value={conn.driver ?? 'mysql'}
          onChange={(e) => handleDriverChange(e.target.value as 'mysql' | 'postgres')}
          style={INPUT_STYLE}
        >
          <option value="mysql">MySQL</option>
          <option value="postgres">PostgreSQL</option>
        </select>
      </Field>

      <Field label="Host">
        <input
          type="text"
          value={conn.host ?? ''}
          onChange={(e) => set('host', e.target.value)}
          placeholder="localhost"
          style={INPUT_STYLE}
        />
      </Field>

      <Field label="Port">
        <input
          type="number"
          value={conn.port ?? ''}
          onChange={(e) => set('port', Number(e.target.value))}
          style={INPUT_STYLE}
        />
      </Field>

      <Field label="Database">
        <input
          type="text"
          value={conn.database ?? ''}
          onChange={(e) => set('database', e.target.value)}
          placeholder="myapp"
          style={INPUT_STYLE}
        />
      </Field>

      <Field label="Username">
        <input
          type="text"
          value={conn.username ?? ''}
          onChange={(e) => set('username', e.target.value)}
          placeholder="root"
          style={INPUT_STYLE}
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          value={conn.password ?? ''}
          onChange={(e) => set('password', e.target.value)}
          autoComplete="new-password"
          style={INPUT_STYLE}
        />
      </Field>

      {conn.driver === 'postgres' && (
        <Field label="Schema (optional)">
          <input
            type="text"
            value={conn.schema ?? ''}
            onChange={(e) => set('schema', e.target.value)}
            placeholder="public"
            style={INPUT_STYLE}
          />
        </Field>
      )}
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────

export function ConnectionForm() {
  const [reference, setReference] = useState<PartialConn>(emptyConn());
  const [target, setTarget] = useState<PartialConn>(emptyConn());
  const [options, setOptions] = useState<CompareOptions>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ data: DiffResult; durationMs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, target, options }),
      });

      const json: ApiResponse = await res.json();

      if (json.success && json.result) {
        setResult({ data: json.result, durationMs: json.durationMs ?? 0 });
        setStatus('success');
      } else {
        setErrorMsg(json.error ?? 'Unknown error');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Failed to reach the server');
      setStatus('error');
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Connection panels */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <ConnPanel title="Reference Database" conn={reference} onChange={setReference} />
          <div style={{ width: '1px', background: '#e5e7eb', flexShrink: 0 }} />
          <ConnPanel title="Target Database" conn={target} onChange={setTarget} />
        </div>

        {/* Options */}
        <details style={{ marginBottom: '16px', fontSize: '13px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#6b7280', marginBottom: '8px' }}>
            Ignore options
          </summary>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '8px' }}>
            {(
              [
                ['ignoreExtraTables', 'Extra tables'],
                ['ignoreExtraColumns', 'Extra columns'],
                ['ignoreIndexes', 'Indexes'],
                ['ignoreForeignKeys', 'Foreign keys'],
                ['ignoreDefaults', 'Default mismatches'],
              ] as [keyof CompareOptions, string][]
            ).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={options[key] ?? false}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </details>

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            padding: '10px 28px',
            background: status === 'loading' ? '#6b7280' : '#1d4ed8',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'loading' ? 'Comparing…' : 'Compare Schemas'}
        </button>
      </form>

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div style={{ marginTop: '20px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
          {errorMsg}
        </div>
      )}

      {/* Results */}
      {status === 'success' && result && (
        <div style={{ marginTop: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>
            Schema Diff Report
          </h2>
          <DiffResults result={result.data} durationMs={result.durationMs} />
        </div>
      )}
    </div>
  );
}
