import type { DiffResult, ColumnDiff, IndexDiff, ForeignKeyDiff } from '../types/diff';

function severityLabel(severity: string): string {
  switch (severity) {
    case 'error':   return '[ERROR]  ';
    case 'warning': return '[WARN]   ';
    default:        return '[INFO]   ';
  }
}

function section(title: string, count: number): string {
  return `\n${title} (${count})\n${'─'.repeat(title.length + String(count).length + 3)}`;
}

function formatColumnDiff(d: ColumnDiff): string {
  const prefix = severityLabel(d.severity);
  switch (d.kind) {
    case 'column_missing':
      return `${prefix}${d.table}.${d.column}  — missing (type: ${d.referenceColumn.type})`;
    case 'column_extra':
      return `${prefix}${d.table}.${d.column}  — extra column in target`;
    case 'column_type_mismatch':
      return `${prefix}${d.table}.${d.column}  — type: ${d.referenceType} → ${d.targetType}`;
    case 'column_nullable_mismatch':
      return `${prefix}${d.table}.${d.column}  — nullable: ${d.referenceNullable} → ${d.targetNullable}`;
    case 'column_default_mismatch':
      return `${prefix}${d.table}.${d.column}  — default: ${d.referenceDefault ?? 'NULL'} → ${d.targetDefault ?? 'NULL'}`;
  }
}

function formatIndexDiff(d: IndexDiff): string {
  const prefix = severityLabel(d.severity);
  switch (d.kind) {
    case 'index_missing':
      return `${prefix}${d.table}.${d.indexName}  — missing (columns: ${d.referenceIndex.columns.join(', ')})`;
    case 'index_extra':
      return `${prefix}${d.table}.${d.indexName}  — extra index in target`;
    case 'index_mismatch':
      return `${prefix}${d.table}.${d.indexName}  — ${d.field}: ${String(d.referenceValue)} → ${String(d.targetValue)}`;
  }
}

function formatFkDiff(d: ForeignKeyDiff): string {
  const prefix = severityLabel(d.severity);
  switch (d.kind) {
    case 'fk_missing':
      return `${prefix}${d.table}.${d.constraintName}  — missing FK → ${d.referenceFk.referencedTable}`;
    case 'fk_extra':
      return `${prefix}${d.table}.${d.constraintName}  — extra FK in target`;
    case 'fk_mismatch':
      return `${prefix}${d.table}.${d.constraintName}  — ${d.field}: ${d.referenceValue} → ${d.targetValue}`;
  }
}

export function formatTextReport(result: DiffResult, generatedAt?: string): string {
  const lines: string[] = [];
  const ts = generatedAt ?? new Date().toISOString();

  lines.push(`DBDiff Schema Report — ${ts}`);
  lines.push('═'.repeat(60));

  // Summary
  lines.push('\nSUMMARY');
  lines.push(`  Tables checked : ${result.summary.tablesChecked}`);
  lines.push(`  Missing tables : ${result.summary.missingTables}`);
  lines.push(`  Extra tables   : ${result.summary.extraTables}`);
  lines.push(`  Total diffs    : ${result.summary.totalDiffs}`);
  lines.push(`  Errors         : ${result.summary.errors}`);
  lines.push(`  Warnings       : ${result.summary.warnings}`);
  lines.push(`  Info           : ${result.summary.infos}`);

  if (result.summary.totalDiffs === 0) {
    lines.push('\n✓ Schemas are identical — no differences found.');
    return lines.join('\n');
  }

  // Missing tables
  if (result.tablesMissing.length > 0) {
    lines.push(section('MISSING TABLES', result.tablesMissing.length));
    for (const d of result.tablesMissing) {
      lines.push(`  ${severityLabel(d.severity)}${d.table}`);
    }
  }

  // Extra tables
  if (result.tablesExtra.length > 0) {
    lines.push(section('EXTRA TABLES', result.tablesExtra.length));
    for (const d of result.tablesExtra) {
      lines.push(`  ${severityLabel(d.severity)}${d.table}`);
    }
  }

  // Column diffs
  if (result.columnDiffs.length > 0) {
    lines.push(section('COLUMN DIFFERENCES', result.columnDiffs.length));
    for (const d of result.columnDiffs) {
      lines.push(`  ${formatColumnDiff(d)}`);
    }
  }

  // Enum diffs
  if (result.enumDiffs.length > 0) {
    lines.push(section('ENUM DIFFERENCES', result.enumDiffs.length));
    for (const d of result.enumDiffs) {
      lines.push(`  ${severityLabel(d.severity)}${d.table}.${d.column}`);
      if (d.missingValues.length > 0) {
        lines.push(`    Missing values : ${d.missingValues.join(', ')}`);
      }
      if (d.extraValues.length > 0) {
        lines.push(`    Extra values   : ${d.extraValues.join(', ')}`);
      }
    }
  }

  // Index diffs
  if (result.indexDiffs.length > 0) {
    lines.push(section('INDEX DIFFERENCES', result.indexDiffs.length));
    for (const d of result.indexDiffs) {
      lines.push(`  ${formatIndexDiff(d)}`);
    }
  }

  // FK diffs
  if (result.foreignKeyDiffs.length > 0) {
    lines.push(section('FOREIGN KEY DIFFERENCES', result.foreignKeyDiffs.length));
    for (const d of result.foreignKeyDiffs) {
      lines.push(`  ${formatFkDiff(d)}`);
    }
  }

  return lines.join('\n');
}
