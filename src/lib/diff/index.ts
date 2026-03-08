import type { DatabaseSchema } from '../types/schema';
import type { DiffResult, DiffSeverity } from '../types/diff';
import { diffTablesMissing, diffTablesExtra } from './tables';
import { diffColumns } from './columns';
import { diffEnums } from './enums';
import { diffIndexes } from './indexes';
import { diffForeignKeys } from './foreignKeys';

/**
 * Pure, stateless schema diff.
 *
 * Compares reference (known-good) against target (potentially drifted).
 * Returns a structured DiffResult — does not throw, does not log.
 * Both schemas must already be normalized by their respective adapters.
 */
export function diffSchemas(reference: DatabaseSchema, target: DatabaseSchema): DiffResult {
  const tablesMissing = diffTablesMissing(reference, target);
  const tablesExtra = diffTablesExtra(reference, target);

  // Only diff internals for tables that exist in both schemas
  const commonTables = Object.keys(reference.tables).filter((t) => t in target.tables);

  const columnDiffs = commonTables.flatMap((table) =>
    diffColumns(reference.tables[table], target.tables[table], table)
  );

  const enumDiffs = commonTables.flatMap((table) =>
    diffEnums(reference.tables[table], target.tables[table], table)
  );

  const indexDiffs = commonTables.flatMap((table) =>
    diffIndexes(reference.tables[table], target.tables[table], table)
  );

  const foreignKeyDiffs = commonTables.flatMap((table) =>
    diffForeignKeys(reference.tables[table], target.tables[table], table)
  );

  const allDiffs = [
    ...tablesMissing,
    ...tablesExtra,
    ...columnDiffs,
    ...enumDiffs,
    ...indexDiffs,
    ...foreignKeyDiffs,
  ];

  const countBySeverity = (s: DiffSeverity) => allDiffs.filter((d) => d.severity === s).length;

  return {
    summary: {
      totalDiffs: allDiffs.length,
      errors: countBySeverity('error'),
      warnings: countBySeverity('warning'),
      infos: countBySeverity('info'),
      tablesChecked: commonTables.length,
      missingTables: tablesMissing.length,
      extraTables: tablesExtra.length,
    },
    tablesMissing,
    tablesExtra,
    columnDiffs,
    enumDiffs,
    indexDiffs,
    foreignKeyDiffs,
  };
}
