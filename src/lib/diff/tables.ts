import type { DatabaseSchema } from '../types/schema';
import type { TableMissingDiff, TableExtraDiff } from '../types/diff';

export function diffTablesMissing(
  reference: DatabaseSchema,
  target: DatabaseSchema
): TableMissingDiff[] {
  return Object.keys(reference.tables)
    .filter((t) => !(t in target.tables))
    .map((table) => ({ kind: 'table_missing' as const, table, severity: 'error' as const }));
}

export function diffTablesExtra(
  reference: DatabaseSchema,
  target: DatabaseSchema
): TableExtraDiff[] {
  return Object.keys(target.tables)
    .filter((t) => !(t in reference.tables))
    .map((table) => ({ kind: 'table_extra' as const, table, severity: 'warning' as const }));
}
