import type { ColumnSchema, IndexSchema, ForeignKeySchema } from './schema';

export type DiffSeverity = 'error' | 'warning' | 'info';

// ── Table-level diffs ──────────────────────────────────────────────────────

export interface TableMissingDiff {
  kind: 'table_missing';
  table: string;
  severity: 'error';
}

export interface TableExtraDiff {
  kind: 'table_extra';
  table: string;
  severity: 'warning';
}

// ── Column-level diffs ─────────────────────────────────────────────────────

export interface ColumnMissingDiff {
  kind: 'column_missing';
  table: string;
  column: string;
  referenceColumn: ColumnSchema;
  severity: 'error';
}

export interface ColumnExtraDiff {
  kind: 'column_extra';
  table: string;
  column: string;
  targetColumn: ColumnSchema;
  severity: 'warning';
}

export interface ColumnTypeMismatchDiff {
  kind: 'column_type_mismatch';
  table: string;
  column: string;
  referenceType: string;
  targetType: string;
  severity: 'error';
}

export interface ColumnNullableMismatchDiff {
  kind: 'column_nullable_mismatch';
  table: string;
  column: string;
  referenceNullable: boolean;
  targetNullable: boolean;
  severity: 'warning';
}

export interface ColumnDefaultMismatchDiff {
  kind: 'column_default_mismatch';
  table: string;
  column: string;
  referenceDefault: string | null;
  targetDefault: string | null;
  severity: 'info';
}

export type ColumnDiff =
  | ColumnMissingDiff
  | ColumnExtraDiff
  | ColumnTypeMismatchDiff
  | ColumnNullableMismatchDiff
  | ColumnDefaultMismatchDiff;

// ── Enum diffs ─────────────────────────────────────────────────────────────

export interface EnumMismatchDiff {
  kind: 'enum_mismatch';
  table: string;
  column: string;
  referenceValues: string[];
  targetValues: string[];
  missingValues: string[];  // in reference, absent in target
  extraValues: string[];    // in target, absent in reference
  severity: 'error';
}

// ── Index diffs ────────────────────────────────────────────────────────────

export interface IndexMissingDiff {
  kind: 'index_missing';
  table: string;
  indexName: string;
  referenceIndex: IndexSchema;
  severity: 'warning';
}

export interface IndexExtraDiff {
  kind: 'index_extra';
  table: string;
  indexName: string;
  targetIndex: IndexSchema;
  severity: 'info';
}

export interface IndexMismatchDiff {
  kind: 'index_mismatch';
  table: string;
  indexName: string;
  field: 'columns' | 'unique';
  referenceValue: string | boolean;
  targetValue: string | boolean;
  severity: 'warning';
}

export type IndexDiff = IndexMissingDiff | IndexExtraDiff | IndexMismatchDiff;

// ── Foreign key diffs ──────────────────────────────────────────────────────

export interface ForeignKeyMissingDiff {
  kind: 'fk_missing';
  table: string;
  constraintName: string;
  referenceFk: ForeignKeySchema;
  severity: 'error';
}

export interface ForeignKeyExtraDiff {
  kind: 'fk_extra';
  table: string;
  constraintName: string;
  targetFk: ForeignKeySchema;
  severity: 'warning';
}

export interface ForeignKeyMismatchDiff {
  kind: 'fk_mismatch';
  table: string;
  constraintName: string;
  field: 'columns' | 'referencedTable' | 'referencedColumns' | 'onDelete' | 'onUpdate';
  referenceValue: string;
  targetValue: string;
  severity: 'error';
}

export type ForeignKeyDiff =
  | ForeignKeyMissingDiff
  | ForeignKeyExtraDiff
  | ForeignKeyMismatchDiff;

// ── Top-level result ───────────────────────────────────────────────────────

export interface DiffSummary {
  totalDiffs: number;
  errors: number;
  warnings: number;
  infos: number;
  tablesChecked: number;
  missingTables: number;
  extraTables: number;
}

export interface DiffResult {
  summary: DiffSummary;
  tablesMissing: TableMissingDiff[];
  tablesExtra: TableExtraDiff[];
  columnDiffs: ColumnDiff[];
  enumDiffs: EnumMismatchDiff[];
  indexDiffs: IndexDiff[];
  foreignKeyDiffs: ForeignKeyDiff[];
}
