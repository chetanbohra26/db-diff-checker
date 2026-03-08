import type { DiffResult } from '../types/diff';
import type { CompareOptions } from './compareSchema';

/**
 * Filter diff results based on user-selected ignore options.
 * Returns a new DiffResult with unwanted categories removed and summary recalculated.
 */
export function applyOptions(result: DiffResult, options: CompareOptions = {}): DiffResult {
  const tablesMissing = result.tablesMissing;
  const tablesExtra = options.ignoreExtraTables ? [] : result.tablesExtra;

  let columnDiffs = result.columnDiffs;
  if (options.ignoreExtraColumns) {
    columnDiffs = columnDiffs.filter((d) => d.kind !== 'column_extra');
  }
  if (options.ignoreDefaults) {
    columnDiffs = columnDiffs.filter((d) => d.kind !== 'column_default_mismatch');
  }

  const enumDiffs = result.enumDiffs;
  const indexDiffs = options.ignoreIndexes ? [] : result.indexDiffs;
  const foreignKeyDiffs = options.ignoreForeignKeys ? [] : result.foreignKeyDiffs;

  const allDiffs = [
    ...tablesMissing,
    ...tablesExtra,
    ...columnDiffs,
    ...enumDiffs,
    ...indexDiffs,
    ...foreignKeyDiffs,
  ];

  return {
    summary: {
      totalDiffs: allDiffs.length,
      errors: allDiffs.filter((d) => d.severity === 'error').length,
      warnings: allDiffs.filter((d) => d.severity === 'warning').length,
      infos: allDiffs.filter((d) => d.severity === 'info').length,
      tablesChecked: result.summary.tablesChecked,
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
