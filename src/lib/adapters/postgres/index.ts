import type { SchemaAdapter } from '../base';
import type { ConnectionConfig } from '../../types/connection';
import type { DatabaseSchema } from '../../types/schema';

export class PostgresAdapter implements SchemaAdapter {
  async loadSchema(_config: ConnectionConfig): Promise<DatabaseSchema> {
    throw new Error('PostgresAdapter.loadSchema not yet implemented');
  }

  async testConnection(_config: ConnectionConfig): Promise<boolean> {
    throw new Error('PostgresAdapter.testConnection not yet implemented');
  }
}
