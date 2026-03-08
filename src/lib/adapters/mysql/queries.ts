/**
 * Bulk queries for MySQL schema loading.
 * All queries are parameterized with the database/schema name.
 * Designed to load the full schema in 4 queries — no per-table queries.
 */

/** All base tables in the target database */
export const TABLES_QUERY = `
  SELECT TABLE_NAME
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = ?
    AND TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME
`;

/**
 * All columns for all tables.
 * COLUMN_TYPE gives the full type including display width and enum values,
 * e.g. "int(11)", "varchar(255)", "enum('active','inactive')"
 */
export const COLUMNS_QUERY = `
  SELECT
    TABLE_NAME,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    EXTRA
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = ?
  ORDER BY TABLE_NAME, ORDINAL_POSITION
`;

/**
 * All indexes for all tables.
 * SEQ_IN_INDEX gives the column position within a composite index.
 * NON_UNIQUE = 0 means unique index.
 */
export const INDEXES_QUERY = `
  SELECT
    TABLE_NAME,
    INDEX_NAME,
    NON_UNIQUE,
    SEQ_IN_INDEX,
    COLUMN_NAME
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = ?
  ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
`;

/**
 * All foreign keys with referential actions.
 * Joins KEY_COLUMN_USAGE and REFERENTIAL_CONSTRAINTS to get ON DELETE / ON UPDATE rules.
 * ORDINAL_POSITION orders columns within composite FKs.
 */
export const FOREIGN_KEYS_QUERY = `
  SELECT
    kcu.TABLE_NAME,
    kcu.CONSTRAINT_NAME,
    kcu.COLUMN_NAME,
    kcu.REFERENCED_TABLE_NAME,
    kcu.REFERENCED_COLUMN_NAME,
    kcu.ORDINAL_POSITION,
    rc.UPDATE_RULE,
    rc.DELETE_RULE
  FROM information_schema.KEY_COLUMN_USAGE kcu
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
  WHERE kcu.TABLE_SCHEMA = ?
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
`;
