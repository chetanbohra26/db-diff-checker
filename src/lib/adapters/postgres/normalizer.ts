/**
 * PostgreSQL type normalization.
 *
 * Goals:
 * - Map pg information_schema data_type + udt_name to canonical forms
 * - Align with MySQL normalizer output so cross-DB comparisons work correctly
 * - Produce the same canonical string for semantically equivalent types
 *   e.g. pg "character varying(255)" == mysql "varchar(255)"
 */

/**
 * Normalize a PostgreSQL column type to a canonical form.
 *
 * @param dataType  - information_schema.columns.data_type
 * @param udtName   - information_schema.columns.udt_name (base type name)
 * @param charMaxLength - character_maximum_length (for varchar/char)
 * @param numericPrecision - numeric_precision (for decimal/numeric)
 * @param numericScale - numeric_scale (for decimal/numeric)
 */
export function normalizePostgresType(
  dataType: string,
  udtName: string,
  charMaxLength: number | null,
  numericPrecision: number | null,
  numericScale: number | null
): string {
  switch (dataType.toLowerCase()) {
    // ── String types ───────────────────────────────────────────────────────
    case 'character varying':
      return charMaxLength ? `varchar(${charMaxLength})` : 'varchar';

    case 'character':
      return charMaxLength ? `char(${charMaxLength})` : 'char';

    case 'text':
      return 'text';

    case 'name': // pg internal type, usually system columns
      return 'varchar';

    // ── Integer types ──────────────────────────────────────────────────────
    case 'smallint':
    case 'int2':
      return 'smallint';

    case 'integer':
    case 'int4':
      return 'int';

    case 'bigint':
    case 'int8':
      return 'bigint';

    // ── Boolean ────────────────────────────────────────────────────────────
    // Cross-DB canonical: MySQL stores boolean as tinyint(1).
    // When comparing pg↔pg, both sides normalize to tinyint(1) consistently.
    case 'boolean':
      return 'tinyint(1)';

    // ── Floating point ─────────────────────────────────────────────────────
    case 'real':
    case 'float4':
      return 'float';

    case 'double precision':
    case 'float8':
      return 'double';

    // ── Decimal / Numeric ──────────────────────────────────────────────────
    case 'numeric':
    case 'decimal':
      if (numericPrecision !== null && numericScale !== null) {
        return `decimal(${numericPrecision},${numericScale})`;
      }
      if (numericPrecision !== null) {
        return `decimal(${numericPrecision})`;
      }
      return 'decimal';

    // ── Date / Time ────────────────────────────────────────────────────────
    case 'date':
      return 'date';

    case 'time without time zone':
    case 'time':
      return 'time';

    case 'time with time zone':
      return 'time with time zone';

    case 'timestamp without time zone':
    case 'timestamp':
      return 'datetime';

    case 'timestamp with time zone':
      return 'timestamp';

    case 'interval':
      return 'interval';

    // ── JSON ───────────────────────────────────────────────────────────────
    case 'json':
      return 'json';

    case 'jsonb':
      return 'jsonb';

    // ── Binary ─────────────────────────────────────────────────────────────
    case 'bytea':
      return 'blob';

    // ── UUID ───────────────────────────────────────────────────────────────
    case 'uuid':
      return 'varchar(36)';

    // ── Network / geometric / other pg-specific types ──────────────────────
    case 'inet':
    case 'cidr':
    case 'macaddr':
    case 'point':
    case 'line':
    case 'lseg':
    case 'box':
    case 'path':
    case 'polygon':
    case 'circle':
      return dataType.toLowerCase();

    // ── Arrays ─────────────────────────────────────────────────────────────
    case 'array':
      // udt_name for arrays is e.g. "_int4", "_text" — strip leading underscore
      return `${udtName.replace(/^_/, '')}[]`;

    // ── User-defined (enums, domains) ──────────────────────────────────────
    // Return the udt_name — the diff engine will compare enumValues separately.
    case 'user-defined':
      return udtName.toLowerCase();

    default:
      // Fall back to udt_name if data_type is something exotic
      return (udtName || dataType).toLowerCase();
  }
}

/**
 * Normalize a PostgreSQL column DEFAULT value for comparison.
 *
 * PostgreSQL wraps many defaults in casts:
 *   nextval('seq'::regclass)
 *   'active'::character varying
 *   true
 *
 * We strip common cast suffixes and align with MySQL's normalizeDefault output.
 */
export function normalizeDefault(value: string | null): string | null {
  if (value === null) return null;

  let v = value.trim();

  // Strip all ::type casts (e.g. 'hello'::character varying, nextval('seq'::regclass))
  // Must do this before lowercasing to handle type names correctly.
  // Global replace handles casts inside function arguments too.
  v = v.replace(/::"?[\w\s]+"?(\[\])?/g, '').trim();

  v = v.toLowerCase();

  // Strip surrounding single quotes
  if (v.startsWith("'") && v.endsWith("'")) {
    v = v.slice(1, -1);
  }

  // Canonical timestamp aliases — aligns with MySQL normalizeDefault
  const timestampAliases: Record<string, string> = {
    'now()': 'current_timestamp',
    'current_timestamp': 'current_timestamp',
    'current_timestamp()': 'current_timestamp',
  };

  return timestampAliases[v] ?? v;
}
