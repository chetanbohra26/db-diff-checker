import mysql from 'mysql2/promise';
import type { SchemaAdapter } from '../base';
import type { ConnectionConfig } from '../../types/connection';
import type {
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
  IndexSchema,
  ForeignKeySchema,
} from '../../types/schema';
import {
  TABLES_QUERY,
  COLUMNS_QUERY,
  INDEXES_QUERY,
  FOREIGN_KEYS_QUERY,
} from './queries';
import { normalizeMySQLType, parseEnumValues, normalizeDefault } from './normalizer';

// ── Raw row shapes from information_schema ────────────────────────────────

interface RawTable {
  TABLE_NAME: string;
}

interface RawColumn {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: string; // 'YES' | 'NO'
  COLUMN_DEFAULT: string | null;
  EXTRA: string | null;
}

interface RawIndex {
  TABLE_NAME: string;
  INDEX_NAME: string;
  NON_UNIQUE: number; // 0 = unique, 1 = non-unique
  SEQ_IN_INDEX: number;
  COLUMN_NAME: string;
}

interface RawForeignKey {
  TABLE_NAME: string;
  CONSTRAINT_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
  ORDINAL_POSITION: number;
  UPDATE_RULE: string;
  DELETE_RULE: string;
}

// ── Schema builder ─────────────────────────────────────────────────────────

function buildSchema(
  tableRows: RawTable[],
  columnRows: RawColumn[],
  indexRows: RawIndex[],
  fkRows: RawForeignKey[]
): DatabaseSchema {
  const tables: Record<string, TableSchema> = {};

  // Seed all known tables (catches tables with zero columns)
  for (const row of tableRows) {
    const name = row.TABLE_NAME.toLowerCase();
    tables[name] = { name, columns: {}, indexes: {}, foreignKeys: {} };
  }

  // ── Columns (single pass) ───────────────────────────────────────────────
  for (const row of columnRows) {
    const tableName = row.TABLE_NAME.toLowerCase();
    const colName = row.COLUMN_NAME.toLowerCase();

    if (!tables[tableName]) {
      // Table appeared in COLUMNS but not TABLES — shouldn't happen, but be safe
      tables[tableName] = { name: tableName, columns: {}, indexes: {}, foreignKeys: {} };
    }

    const rawType = row.COLUMN_TYPE;
    const normalizedType = normalizeMySQLType(rawType);

    // Extract enum values when column type is enum or set
    let enumValues: string[] | null = null;
    const enumMatch = rawType.match(/^(enum|set)\((.+)\)$/i);
    if (enumMatch) {
      enumValues = parseEnumValues(enumMatch[2]);
    }

    const column: ColumnSchema = {
      name: colName,
      type: normalizedType,
      nullable: row.IS_NULLABLE === 'YES',
      default: normalizeDefault(row.COLUMN_DEFAULT),
      extra: row.EXTRA ? row.EXTRA.toLowerCase() : null,
      enumValues,
    };

    tables[tableName].columns[colName] = column;
  }

  // ── Indexes (single pass, accumulate multi-column indexes) ───────────────
  // Temporary accumulator: tableName → indexName → { row, columns[] }
  const indexAccumulator: Record<
    string,
    Record<string, { nonUnique: number; primary: boolean; columns: string[] }>
  > = {};

  for (const row of indexRows) {
    const tableName = row.TABLE_NAME.toLowerCase();
    const indexName = row.INDEX_NAME; // keep original case — 'PRIMARY' is significant

    if (!indexAccumulator[tableName]) indexAccumulator[tableName] = {};
    if (!indexAccumulator[tableName][indexName]) {
      indexAccumulator[tableName][indexName] = {
        nonUnique: row.NON_UNIQUE,
        primary: indexName === 'PRIMARY',
        columns: [],
      };
    }
    // SEQ_IN_INDEX is 1-based and rows are ordered — just push in order
    indexAccumulator[tableName][indexName].columns.push(row.COLUMN_NAME.toLowerCase());
  }

  for (const [tableName, indexes] of Object.entries(indexAccumulator)) {
    if (!tables[tableName]) continue;
    for (const [indexName, data] of Object.entries(indexes)) {
      const index: IndexSchema = {
        name: indexName,
        columns: data.columns,
        unique: data.nonUnique === 0,
        primary: data.primary,
      };
      tables[tableName].indexes[indexName] = index;
    }
  }

  // ── Foreign keys (single pass, accumulate multi-column FKs) ─────────────
  const fkAccumulator: Record<
    string,
    Record<
      string,
      {
        referencedTable: string;
        columns: string[];
        referencedColumns: string[];
        updateRule: string;
        deleteRule: string;
      }
    >
  > = {};

  for (const row of fkRows) {
    const tableName = row.TABLE_NAME.toLowerCase();
    const constraintName = row.CONSTRAINT_NAME;

    if (!fkAccumulator[tableName]) fkAccumulator[tableName] = {};
    if (!fkAccumulator[tableName][constraintName]) {
      fkAccumulator[tableName][constraintName] = {
        referencedTable: row.REFERENCED_TABLE_NAME.toLowerCase(),
        columns: [],
        referencedColumns: [],
        updateRule: row.UPDATE_RULE,
        deleteRule: row.DELETE_RULE,
      };
    }
    fkAccumulator[tableName][constraintName].columns.push(row.COLUMN_NAME.toLowerCase());
    fkAccumulator[tableName][constraintName].referencedColumns.push(
      row.REFERENCED_COLUMN_NAME.toLowerCase()
    );
  }

  for (const [tableName, fks] of Object.entries(fkAccumulator)) {
    if (!tables[tableName]) continue;
    for (const [constraintName, data] of Object.entries(fks)) {
      const fk: ForeignKeySchema = {
        name: constraintName,
        columns: data.columns,
        referencedTable: data.referencedTable,
        referencedColumns: data.referencedColumns,
        onDelete: data.deleteRule,
        onUpdate: data.updateRule,
      };
      tables[tableName].foreignKeys[constraintName] = fk;
    }
  }

  return { tables, driver: 'mysql' };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export class MySQLAdapter implements SchemaAdapter {
  async loadSchema(config: ConnectionConfig): Promise<DatabaseSchema> {
    const connection = await this.createConnection(config);
    try {
      const db = config.database;

      // Run all 4 queries — sequential to avoid overwhelming the DB
      const [tableRows] = await connection.query<mysql.RowDataPacket[]>(TABLES_QUERY, [db]);
      const [columnRows] = await connection.query<mysql.RowDataPacket[]>(COLUMNS_QUERY, [db]);
      const [indexRows] = await connection.query<mysql.RowDataPacket[]>(INDEXES_QUERY, [db]);
      const [fkRows] = await connection.query<mysql.RowDataPacket[]>(FOREIGN_KEYS_QUERY, [db]);

      return buildSchema(
        tableRows as unknown as RawTable[],
        columnRows as unknown as RawColumn[],
        indexRows as unknown as RawIndex[],
        fkRows as unknown as RawForeignKey[]
      );
    } finally {
      await connection.end();
    }
  }

  async testConnection(config: ConnectionConfig): Promise<boolean> {
    const connection = await this.createConnection(config);
    try {
      await connection.query('SELECT 1');
      return true;
    } finally {
      await connection.end();
    }
  }

  private async createConnection(config: ConnectionConfig): Promise<mysql.Connection> {
    return mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
      connectTimeout: config.connectTimeoutMs ?? 10_000,
    });
  }
}
