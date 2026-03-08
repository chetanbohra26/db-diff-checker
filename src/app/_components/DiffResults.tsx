'use client';

import { DiffSection } from './DiffSection';
import { StatusBadge } from './StatusBadge';
import { formatTextReport } from '@/lib/report/text';
import type { DiffResult, ColumnDiff, IndexDiff, ForeignKeyDiff, EnumMismatchDiff } from '@/lib/types/diff';

interface DiffResultsProps {
  result: DiffResult;
  durationMs: number;
}

// ── Row renderers ──────────────────────────────────────────────────────────

function Row({ children, color = '#111827' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', color, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function Val({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span style={{ color: '#6b7280' }}>{label}: </span>
      <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>{value}</code>
    </span>
  );
}

function Arrow() {
  return <span style={{ margin: '0 6px', color: '#9ca3af' }}>→</span>;
}

function renderColumnDiff(d: ColumnDiff) {
  const loc = `${d.table}.${d.column}`;
  switch (d.kind) {
    case 'column_missing':
      return <Row key={loc + d.kind} color="#dc2626">✗ <b>{loc}</b> — missing column (type: {d.referenceColumn.type})</Row>;
    case 'column_extra':
      return <Row key={loc + d.kind} color="#d97706">+ <b>{loc}</b> — extra column in target</Row>;
    case 'column_type_mismatch':
      return <Row key={loc + d.kind} color="#dc2626">⚠ <b>{loc}</b> — type: <Val label="ref" value={d.referenceType} /><Arrow /><Val label="tgt" value={d.targetType} /></Row>;
    case 'column_nullable_mismatch':
      return <Row key={loc + d.kind} color="#d97706">⚠ <b>{loc}</b> — nullable: {String(d.referenceNullable)}<Arrow />{String(d.targetNullable)}</Row>;
    case 'column_default_mismatch':
      return <Row key={loc + d.kind} color="#2563eb">ℹ <b>{loc}</b> — default: {d.referenceDefault ?? 'NULL'}<Arrow />{d.targetDefault ?? 'NULL'}</Row>;
  }
}

function renderEnumDiff(d: EnumMismatchDiff) {
  return (
    <Row key={`${d.table}.${d.column}`} color="#dc2626">
      ⚠ <b>{d.table}.{d.column}</b>
      {d.missingValues.length > 0 && <span> — missing: <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>{d.missingValues.join(', ')}</code></span>}
      {d.extraValues.length > 0 && <span> — extra: <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>{d.extraValues.join(', ')}</code></span>}
    </Row>
  );
}

function renderIndexDiff(d: IndexDiff) {
  const loc = `${d.table}.${d.indexName}`;
  switch (d.kind) {
    case 'index_missing':
      return <Row key={loc + d.kind} color="#d97706">✗ <b>{loc}</b> — missing index (columns: {d.referenceIndex.columns.join(', ')})</Row>;
    case 'index_extra':
      return <Row key={loc + d.kind} color="#2563eb">+ <b>{loc}</b> — extra index in target</Row>;
    case 'index_mismatch':
      return <Row key={loc + d.kind} color="#d97706">⚠ <b>{loc}</b> — {d.field}: {String(d.referenceValue)}<Arrow />{String(d.targetValue)}</Row>;
  }
}

function renderFkDiff(d: ForeignKeyDiff) {
  const loc = `${d.table}.${d.constraintName}`;
  switch (d.kind) {
    case 'fk_missing':
      return <Row key={loc + d.kind} color="#dc2626">✗ <b>{loc}</b> — missing FK → {d.referenceFk.referencedTable}</Row>;
    case 'fk_extra':
      return <Row key={loc + d.kind} color="#d97706">+ <b>{loc}</b> — extra FK in target</Row>;
    case 'fk_mismatch':
      return <Row key={loc + d.kind} color="#dc2626">⚠ <b>{loc}</b> — {d.field}: {d.referenceValue}<Arrow />{d.targetValue}</Row>;
  }
}

// ── Main component ─────────────────────────────────────────────────────────

export function DiffResults({ result, durationMs }: DiffResultsProps) {
  const { summary } = result;

  function handleExport() {
    const text = formatTextReport(result);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dbdiff-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '4px' }}>
          {summary.tablesChecked} tables checked · {durationMs}ms
        </span>
        {summary.errors > 0 && <StatusBadge severity="error" count={summary.errors} label="errors" />}
        {summary.warnings > 0 && <StatusBadge severity="warning" count={summary.warnings} label="warnings" />}
        {summary.infos > 0 && <StatusBadge severity="info" count={summary.infos} label="info" />}
        {summary.totalDiffs === 0 && (
          <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>✓ Schemas are identical</span>
        )}
        <button
          onClick={handleExport}
          style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
        >
          Export .txt
        </button>
      </div>

      {/* Diff sections */}
      <DiffSection title="Missing Tables" count={result.tablesMissing.length} severity="error">
        {result.tablesMissing.map((d) => (
          <Row key={d.table} color="#dc2626">✗ <b>{d.table}</b></Row>
        ))}
      </DiffSection>

      <DiffSection title="Extra Tables" count={result.tablesExtra.length} severity="warning">
        {result.tablesExtra.map((d) => (
          <Row key={d.table} color="#d97706">+ <b>{d.table}</b></Row>
        ))}
      </DiffSection>

      <DiffSection title="Column Differences" count={result.columnDiffs.length} severity="error">
        {result.columnDiffs.map(renderColumnDiff)}
      </DiffSection>

      <DiffSection title="Enum Differences" count={result.enumDiffs.length} severity="error">
        {result.enumDiffs.map(renderEnumDiff)}
      </DiffSection>

      <DiffSection title="Index Differences" count={result.indexDiffs.length} severity="warning">
        {result.indexDiffs.map(renderIndexDiff)}
      </DiffSection>

      <DiffSection title="Foreign Key Differences" count={result.foreignKeyDiffs.length} severity="error">
        {result.foreignKeyDiffs.map(renderFkDiff)}
      </DiffSection>
    </div>
  );
}
