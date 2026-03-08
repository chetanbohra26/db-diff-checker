import type { TableSchema } from '../types/schema';
import type { ColumnDiff } from '../types/diff';

export function diffColumns(
  refTable: TableSchema,
  tgtTable: TableSchema,
  tableName: string
): ColumnDiff[] {
  const diffs: ColumnDiff[] = [];

  // ── Missing columns (in reference, absent in target) ──────────────────────
  for (const [colName, refCol] of Object.entries(refTable.columns)) {
    if (!(colName in tgtTable.columns)) {
      diffs.push({
        kind: 'column_missing',
        table: tableName,
        column: colName,
        referenceColumn: refCol,
        severity: 'error',
      });
    }
  }

  // ── Extra columns (in target, absent in reference) ────────────────────────
  for (const [colName, tgtCol] of Object.entries(tgtTable.columns)) {
    if (!(colName in refTable.columns)) {
      diffs.push({
        kind: 'column_extra',
        table: tableName,
        column: colName,
        targetColumn: tgtCol,
        severity: 'warning',
      });
    }
  }

  // ── Attribute diffs for columns present in both ───────────────────────────
  for (const colName of Object.keys(refTable.columns)) {
    if (!(colName in tgtTable.columns)) continue;

    const refCol = refTable.columns[colName];
    const tgtCol = tgtTable.columns[colName];

    // Type mismatch — skip enum columns (handled by diffEnums)
    const refIsEnum = refCol.enumValues !== null;
    const tgtIsEnum = tgtCol.enumValues !== null;
    if (!refIsEnum && !tgtIsEnum && refCol.type !== tgtCol.type) {
      diffs.push({
        kind: 'column_type_mismatch',
        table: tableName,
        column: colName,
        referenceType: refCol.type,
        targetType: tgtCol.type,
        severity: 'error',
      });
    }

    // Nullable mismatch
    if (refCol.nullable !== tgtCol.nullable) {
      diffs.push({
        kind: 'column_nullable_mismatch',
        table: tableName,
        column: colName,
        referenceNullable: refCol.nullable,
        targetNullable: tgtCol.nullable,
        severity: 'warning',
      });
    }

    // Default mismatch — already normalized by each adapter's normalizeDefault
    if (refCol.default !== tgtCol.default) {
      diffs.push({
        kind: 'column_default_mismatch',
        table: tableName,
        column: colName,
        referenceDefault: refCol.default,
        targetDefault: tgtCol.default,
        severity: 'info',
      });
    }
  }

  return diffs;
}
