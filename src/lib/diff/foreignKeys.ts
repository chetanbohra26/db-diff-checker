import type { TableSchema, ForeignKeySchema } from '../types/schema';
import type { ForeignKeyDiff } from '../types/diff';

/**
 * Structural signature for matching FKs across DBs.
 * Constraint names are arbitrary and differ across migrations, so we match
 * by the columns involved and the referenced table/columns instead.
 */
function fkSignature(fk: ForeignKeySchema): string {
  return [
    fk.columns.join(','),
    fk.referencedTable,
    fk.referencedColumns.join(','),
  ].join('|');
}

export function diffForeignKeys(
  refTable: TableSchema,
  tgtTable: TableSchema,
  tableName: string
): ForeignKeyDiff[] {
  const diffs: ForeignKeyDiff[] = [];

  const refFks = Object.values(refTable.foreignKeys);
  const tgtFks = Object.values(tgtTable.foreignKeys);

  // Build signature → FK map for target
  const tgtBySignature = new Map<string, ForeignKeySchema>();
  const tgtMatched = new Set<string>();
  for (const fk of tgtFks) {
    tgtBySignature.set(fkSignature(fk), fk);
  }

  for (const refFk of refFks) {
    const sig = fkSignature(refFk);
    const tgtFk = tgtBySignature.get(sig);

    if (!tgtFk) {
      diffs.push({
        kind: 'fk_missing',
        table: tableName,
        constraintName: refFk.name,
        referenceFk: refFk,
        severity: 'error',
      });
    } else {
      tgtMatched.add(sig);

      // Check referential action mismatches for matched FKs
      if (refFk.onDelete !== tgtFk.onDelete) {
        diffs.push({
          kind: 'fk_mismatch',
          table: tableName,
          constraintName: refFk.name,
          field: 'onDelete',
          referenceValue: refFk.onDelete,
          targetValue: tgtFk.onDelete,
          severity: 'error',
        });
      }

      if (refFk.onUpdate !== tgtFk.onUpdate) {
        diffs.push({
          kind: 'fk_mismatch',
          table: tableName,
          constraintName: refFk.name,
          field: 'onUpdate',
          referenceValue: refFk.onUpdate,
          targetValue: tgtFk.onUpdate,
          severity: 'error',
        });
      }
    }
  }

  // Extra FKs in target not matched to any reference FK
  for (const tgtFk of tgtFks) {
    if (!tgtMatched.has(fkSignature(tgtFk))) {
      diffs.push({
        kind: 'fk_extra',
        table: tableName,
        constraintName: tgtFk.name,
        targetFk: tgtFk,
        severity: 'warning',
      });
    }
  }

  return diffs;
}
