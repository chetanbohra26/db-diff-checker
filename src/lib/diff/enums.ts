import type { TableSchema } from '../types/schema';
import type { EnumMismatchDiff } from '../types/diff';

export function diffEnums(
  refTable: TableSchema,
  tgtTable: TableSchema,
  tableName: string
): EnumMismatchDiff[] {
  const diffs: EnumMismatchDiff[] = [];

  for (const [colName, refCol] of Object.entries(refTable.columns)) {
    if (refCol.enumValues === null) continue;     // not an enum column
    if (!(colName in tgtTable.columns)) continue; // missing column handled by diffColumns

    const tgtCol = tgtTable.columns[colName];
    if (tgtCol.enumValues === null) continue;     // target changed from enum — caught by type mismatch

    const refSet = new Set(refCol.enumValues);
    const tgtSet = new Set(tgtCol.enumValues);

    const missingValues = refCol.enumValues.filter((v) => !tgtSet.has(v));
    const extraValues = tgtCol.enumValues.filter((v) => !refSet.has(v));

    if (missingValues.length > 0 || extraValues.length > 0) {
      diffs.push({
        kind: 'enum_mismatch',
        table: tableName,
        column: colName,
        referenceValues: refCol.enumValues,
        targetValues: tgtCol.enumValues,
        missingValues,
        extraValues,
        severity: 'error',
      });
    }
  }

  return diffs;
}
