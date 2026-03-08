import type { TableSchema, IndexSchema } from '../types/schema';
import type { IndexDiff } from '../types/diff';

/**
 * Canonical signature for a non-primary index used for matching.
 * We match by column set + uniqueness rather than by name, because index names
 * differ across DBs (e.g. MySQL auto-names vs explicit Postgres names) and
 * across migrations.
 */
function indexSignature(index: IndexSchema): string {
  return [...index.columns].sort().join(',') + ':' + String(index.unique);
}

export function diffIndexes(
  refTable: TableSchema,
  tgtTable: TableSchema,
  tableName: string
): IndexDiff[] {
  const diffs: IndexDiff[] = [];

  const refIndexes = Object.values(refTable.indexes);
  const tgtIndexes = Object.values(tgtTable.indexes);

  // ── Primary key comparison ────────────────────────────────────────────────
  // Match by isPrimary flag — names differ between DBs ('PRIMARY' vs '{table}_pkey')
  const refPrimary = refIndexes.find((i) => i.primary);
  const tgtPrimary = tgtIndexes.find((i) => i.primary);

  if (refPrimary && tgtPrimary) {
    const refCols = [...refPrimary.columns].sort().join(',');
    const tgtCols = [...tgtPrimary.columns].sort().join(',');
    if (refCols !== tgtCols) {
      diffs.push({
        kind: 'index_mismatch',
        table: tableName,
        indexName: refPrimary.name,
        field: 'columns',
        referenceValue: refCols,
        targetValue: tgtCols,
        severity: 'warning',
      });
    }
  } else if (refPrimary && !tgtPrimary) {
    diffs.push({
      kind: 'index_missing',
      table: tableName,
      indexName: refPrimary.name,
      referenceIndex: refPrimary,
      severity: 'warning',
    });
  } else if (!refPrimary && tgtPrimary) {
    diffs.push({
      kind: 'index_extra',
      table: tableName,
      indexName: tgtPrimary.name,
      targetIndex: tgtPrimary,
      severity: 'info',
    });
  }

  // ── Non-primary index comparison ──────────────────────────────────────────
  const refNonPrimary = refIndexes.filter((i) => !i.primary);
  const tgtNonPrimary = tgtIndexes.filter((i) => !i.primary);

  // Build a map of signature → index for the target, for O(1) lookup
  const tgtBySignature = new Map<string, IndexSchema>();
  const tgtMatched = new Set<string>();
  for (const idx of tgtNonPrimary) {
    tgtBySignature.set(indexSignature(idx), idx);
  }

  for (const refIdx of refNonPrimary) {
    const sig = indexSignature(refIdx);
    const tgtIdx = tgtBySignature.get(sig);

    if (!tgtIdx) {
      diffs.push({
        kind: 'index_missing',
        table: tableName,
        indexName: refIdx.name,
        referenceIndex: refIdx,
        severity: 'warning',
      });
    } else {
      tgtMatched.add(sig);
      // Signatures match — no further column/uniqueness diff needed
      // (signature already encodes both columns and uniqueness)
    }
  }

  // Extra indexes in target not matched to any reference index
  for (const tgtIdx of tgtNonPrimary) {
    if (!tgtMatched.has(indexSignature(tgtIdx))) {
      diffs.push({
        kind: 'index_extra',
        table: tableName,
        indexName: tgtIdx.name,
        targetIndex: tgtIdx,
        severity: 'info',
      });
    }
  }

  return diffs;
}
