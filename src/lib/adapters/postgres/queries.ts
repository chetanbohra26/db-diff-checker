/**
 * Bulk queries for PostgreSQL schema loading.
 * All queries are parameterized with the schema name (default: 'public').
 * Designed to load the full schema in 4 queries — no per-table queries.
 *
 * Note: We prefer pg_catalog over information_schema for indexes because
 * information_schema does not expose partial indexes or expression indexes,
 * and pg_catalog gives us the indisprimary flag directly.
 */

/** All columns for all base tables in the target schema */
export const COLUMNS_QUERY = `
  SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.is_nullable,
    c.column_default,
    c.ordinal_position
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_name = c.table_name
   AND t.table_schema = c.table_schema
  WHERE c.table_schema = $1
    AND t.table_type = 'BASE TABLE'
  ORDER BY c.table_name, c.ordinal_position
`;

/**
 * All enum types and their labels in the target schema.
 * Used to hydrate enumValues on columns where data_type = 'USER-DEFINED'.
 */
export const ENUMS_QUERY = `
  SELECT
    t.typname   AS enum_name,
    e.enumlabel AS enum_value
  FROM pg_catalog.pg_type t
  JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = $1
  ORDER BY t.typname, e.enumsortorder
`;

/**
 * All indexes via pg_catalog for accuracy.
 * Uses unnest(ix.indkey) to expand the column array in key order.
 * Excludes system columns (attnum <= 0).
 */
export const INDEXES_QUERY = `
  SELECT
    t.relname                                          AS table_name,
    i.relname                                          AS index_name,
    ix.indisunique                                     AS is_unique,
    ix.indisprimary                                    AS is_primary,
    array_agg(a.attname ORDER BY k.seq)                AS column_names
  FROM pg_catalog.pg_class t
  JOIN pg_catalog.pg_index ix      ON ix.indrelid  = t.oid
  JOIN pg_catalog.pg_class i       ON i.oid        = ix.indexrelid
  JOIN pg_catalog.pg_namespace n   ON n.oid        = t.relnamespace
  JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, seq) ON TRUE
  JOIN pg_catalog.pg_attribute a
    ON a.attrelid = t.oid
   AND a.attnum   = k.attnum
  WHERE n.nspname  = $1
    AND t.relkind  = 'r'
    AND a.attnum   > 0
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary
  ORDER BY t.relname, i.relname
`;

/**
 * All foreign keys with referential actions.
 * Uses pg_catalog (conkey/confkey arrays) to avoid the Cartesian product that
 * information_schema produces when joining key_column_usage with
 * constraint_column_usage for composite FKs.
 * unnest(c.conkey, c.confkey) with ordinality unnests both arrays in parallel,
 * preserving column-to-referenced-column positional correspondence.
 */
export const FOREIGN_KEYS_QUERY = `
  SELECT
    t.relname                                                      AS table_name,
    c.conname                                                      AS constraint_name,
    array_agg(a.attname  ORDER BY k.seq)                           AS columns,
    rt.relname                                                     AS referenced_table,
    array_agg(ra.attname ORDER BY k.seq)                           AS referenced_columns,
    CASE c.confupdtype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END AS update_rule,
    CASE c.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END AS delete_rule
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_class t      ON t.oid  = c.conrelid
  JOIN pg_catalog.pg_class rt     ON rt.oid = c.confrelid
  JOIN pg_catalog.pg_namespace n  ON n.oid  = t.relnamespace
  JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS k(attnum, rattnum, seq) ON TRUE
  JOIN pg_catalog.pg_attribute a  ON a.attrelid = c.conrelid   AND a.attnum = k.attnum
  JOIN pg_catalog.pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = k.rattnum
  WHERE c.contype  = 'f'
    AND n.nspname  = $1
  GROUP BY t.relname, c.conname, rt.relname, c.confupdtype, c.confdeltype
  ORDER BY t.relname, c.conname
`;
