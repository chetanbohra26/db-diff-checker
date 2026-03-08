/**
 * MySQL type normalization.
 *
 * Goals:
 * - Eliminate false positives from cosmetic MySQL differences (display widths, etc.)
 * - Produce canonical types that can be compared cross-DB with the Postgres normalizer
 * - Preserve semantically meaningful type information (varchar length, decimal precision)
 */

/**
 * Normalize a MySQL COLUMN_TYPE value to a canonical form.
 *
 * Examples:
 *   int(11)              → int
 *   bigint(20) unsigned  → bigint unsigned
 *   tinyint(1)           → tinyint(1)   ← preserved: MySQL boolean convention
 *   varchar(255)         → varchar(255) ← preserved: length is meaningful
 *   ENUM('a','b')        → enum('a','b') (lowercased, enum values unchanged)
 *   DATETIME             → datetime
 */
export function normalizeMySQLType(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // ── Enum / Set ────────────────────────────────────────────────────────────
  // Return a lowercased form; enum values are extracted separately by parseEnumValues().
  // We keep the parenthesised form here so the type string itself indicates "enum".
  const enumMatch = trimmed.match(/^(enum|set)\((.+)\)$/i);
  if (enumMatch) {
    const keyword = enumMatch[1].toLowerCase();
    const values = parseEnumValues(enumMatch[2]);
    // Re-escape single quotes inside values using doubled single-quote convention
    return `${keyword}(${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')})`;
  }

  // ── Integer display-width stripping ───────────────────────────────────────
  // MySQL 8.0+ deprecated display widths for integers.
  // int(11), bigint(20), smallint(6), etc. are cosmetically different but identical.
  // EXCEPTION: tinyint(1) is MySQL's boolean — preserve it.
  const intMatch = lower.match(
    /^(tinyint|smallint|mediumint|int|bigint)\((\d+)\)(?: unsigned)?(?: zerofill)?$/
  );
  if (intMatch) {
    const intType = intMatch[1];
    const displayWidth = intMatch[2];
    const unsigned = lower.includes('unsigned');

    // Preserve tinyint(1) — used as boolean; keep unsigned qualifier if present
    if (intType === 'tinyint' && displayWidth === '1') {
      return unsigned ? 'tinyint(1) unsigned' : 'tinyint(1)';
    }

    return unsigned ? `${intType} unsigned` : intType;
  }

  // ── Decimal / Numeric with zerofill stripping ─────────────────────────────
  const decimalMatch = lower.match(
    /^(decimal|numeric|float|double)\(([\d,]+)\)(?: unsigned)?(?: zerofill)?$/
  );
  if (decimalMatch) {
    const base = `${decimalMatch[1]}(${decimalMatch[2]})`;
    return lower.includes('unsigned') ? `${base} unsigned` : base;
  }

  // ── Default: just lowercase ───────────────────────────────────────────────
  return lower;
}

/**
 * Parse enum values from the interior of an enum/set definition.
 *
 * Input:  `'active','inactive','pending'`
 * Output: ['active', 'inactive', 'pending']
 *
 * Handles escaped single quotes inside values (e.g. `'it''s'` or `'it\'s'`).
 */
export function parseEnumValues(raw: string): string[] {
  const values: string[] = [];
  // Match single-quoted strings, handling \' and '' as escaped quotes
  const regex = /'((?:[^'\\]|\\.|'')*)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    // Unescape both \' and '' → '
    values.push(match[1].replace(/''/g, "'").replace(/\\'/g, "'"));
  }
  return values;
}

/**
 * Normalize a column DEFAULT value for comparison.
 *
 * - Trims whitespace
 * - Lowercases
 * - Normalizes common timestamp defaults to a canonical form
 * - Strips surrounding quotes added by some MySQL versions
 */
export function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;

  const trimmed = value.trim();

  // String literal defaults (single-quoted) are preserved exactly as-is.
  // Case and content are semantically significant — 'Active' ≠ 'active'.
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed;
  }

  // SQL expression defaults are case-insensitive — canonicalize to lowercase
  const lower = trimmed.toLowerCase();

  const timestampAliases: Record<string, string> = {
    'current_timestamp()': 'current_timestamp',
    'now()': 'current_timestamp',
    'localtime': 'current_timestamp',
    'localtime()': 'current_timestamp',
    'localtimestamp': 'current_timestamp',
    'localtimestamp()': 'current_timestamp',
  };

  return timestampAliases[lower] ?? lower;
}
