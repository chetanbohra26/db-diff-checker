import { Client } from 'pg';
import type { SchemaAdapter } from '../base';
import type { ConnectionConfig } from '../../types/connection';
import type {
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
  IndexSchema,
  ForeignKeySchema,
} from '../../types/schema';
import { COLUMNS_QUERY, ENUMS_QUERY, INDEXES_QUERY, FOREIGN_KEYS_QUERY } from './queries';
import { normalizePostgresType, normalizeDefault } from './normalizer';
import { sanitizeError } from '../../util/sanitizeError';

// ── Raw row shapes ─────────────────────────────────────────────────────────

interface RawColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: string; // 'YES' | 'NO'
  column_default: string | null;
}

interface RawEnum {
  enum_name: string;
  enum_value: string;
}

interface RawIndex {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  column_names: string[]; // pg driver returns array columns as JS arrays
}

interface RawForeignKey {
  table_name: string;
  constraint_name: string;
  columns: string[];
  referenced_table: string;
  referenced_columns: string[];
  update_rule: string;
  delete_rule: string;
}

// ── Schema builder ─────────────────────────────────────────────────────────

function buildSchema(
  columnRows: RawColumn[],
  enumRows: RawEnum[],
  indexRows: RawIndex[],
  fkRows: RawForeignKey[]
): DatabaseSchema {
  const tables: Record<string, TableSchema> = {};

  // ── Build enum catalog: enumName → values[] ──────────────────────────────
  const enumCatalog: Record<string, string[]> = {};
  for (const row of enumRows) {
    const enumName = row.enum_name.toLowerCase();
    if (!enumCatalog[enumName]) enumCatalog[enumName] = [];
    enumCatalog[enumName].push(row.enum_value);
  }

  // ── Columns (single pass) ────────────────────────────────────────────────
  for (const row of columnRows) {
    const tableName = row.table_name.toLowerCase();
    const colName = row.column_name.toLowerCase();

    if (!tables[tableName]) {
      tables[tableName] = { name: tableName, columns: {}, indexes: {}, foreignKeys: {} };
    }

    const normalizedType = normalizePostgresType(
      row.data_type,
      row.udt_name,
      row.character_maximum_length,
      row.numeric_precision,
      row.numeric_scale
    );

    // Resolve enum values for USER-DEFINED types
    let enumValues: string[] | null = null;
    if (row.data_type.toLowerCase() === 'user-defined') {
      enumValues = enumCatalog[row.udt_name.toLowerCase()] ?? null;
    }

    const column: ColumnSchema = {
      name: colName,
      type: normalizedType,
      nullable: row.is_nullable === 'YES',
      default: normalizeDefault(row.column_default),
      extra: null, // PostgreSQL has no equivalent of MySQL's EXTRA field
      enumValues,
    };

    tables[tableName].columns[colName] = column;
  }

  // ── Indexes (single pass) ────────────────────────────────────────────────
  for (const row of indexRows) {
    const tableName = row.table_name.toLowerCase();
    if (!tables[tableName]) continue;

    const indexName = row.index_name.toLowerCase();
    const index: IndexSchema = {
      name: indexName,
      columns: row.column_names.map((c) => c.toLowerCase()),
      unique: row.is_unique,
      primary: row.is_primary,
    };

    tables[tableName].indexes[indexName] = index;
  }

  // ── Foreign keys (single pass) ───────────────────────────────────────────
  for (const row of fkRows) {
    const tableName = row.table_name.toLowerCase();
    if (!tables[tableName]) continue;

    const constraintName = row.constraint_name.toLowerCase();
    const fk: ForeignKeySchema = {
      name: constraintName,
      columns: row.columns.map((c) => c.toLowerCase()),
      referencedTable: row.referenced_table.toLowerCase(),
      referencedColumns: row.referenced_columns.map((c) => c.toLowerCase()),
      onDelete: row.delete_rule,
      onUpdate: row.update_rule,
    };

    tables[tableName].foreignKeys[constraintName] = fk;
  }

  return { tables, driver: 'postgres' };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export class PostgresAdapter implements SchemaAdapter {
  async loadSchema(config: ConnectionConfig): Promise<DatabaseSchema> {
    const client = this.createClient(config);
    let connected = false;
    try {
      await client.connect();
      connected = true;
      const schema = config.schema ?? 'public';

      // Run all 4 queries in parallel
      const [columnsResult, enumsResult, indexesResult, fksResult] = await Promise.all([
        client.query<RawColumn>(COLUMNS_QUERY, [schema]),
        client.query<RawEnum>(ENUMS_QUERY, [schema]),
        client.query<RawIndex>(INDEXES_QUERY, [schema]),
        client.query<RawForeignKey>(FOREIGN_KEYS_QUERY, [schema]),
      ]);

      return buildSchema(
        columnsResult.rows,
        enumsResult.rows,
        indexesResult.rows,
        fksResult.rows
      );
    } catch (err) {
      throw sanitizeError(err, 'Failed to load schema');
    } finally {
      if (connected) await client.end();
    }
  }

  async testConnection(config: ConnectionConfig): Promise<boolean> {
    const client = this.createClient(config);
    let connected = false;
    try {
      await client.connect();
      connected = true;
      await client.query('SELECT 1');
      return true;
    } catch (err) {
      throw sanitizeError(err, 'Failed to connect to database');
    } finally {
      if (connected) await client.end();
    }
  }

  private createClient(config: ConnectionConfig): Client {
    return new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
      connectionTimeoutMillis: config.connectTimeoutMs ?? 10_000,
    });
  }
}
