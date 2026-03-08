import type { DatabaseDriver } from '../types/connection';
import type { SchemaAdapter } from './base';

// Adapters are imported lazily so the registry doesn't fail to compile
// before the adapter implementations exist.
let _mysql: SchemaAdapter | null = null;
let _postgres: SchemaAdapter | null = null;

export async function getAdapter(driver: DatabaseDriver): Promise<SchemaAdapter> {
  if (driver === 'mysql') {
    if (!_mysql) {
      const { MySQLAdapter } = await import('./mysql');
      _mysql = new MySQLAdapter();
    }
    return _mysql;
  }

  if (driver === 'postgres') {
    if (!_postgres) {
      const { PostgresAdapter } = await import('./postgres');
      _postgres = new PostgresAdapter();
    }
    return _postgres;
  }

  throw new Error(`Unsupported database driver: ${driver}`);
}
