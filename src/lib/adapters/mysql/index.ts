import type { SchemaAdapter } from '../base';
import type { ConnectionConfig } from '../../types/connection';
import type { DatabaseSchema } from '../../types/schema';

export class MySQLAdapter implements SchemaAdapter {
  async loadSchema(_config: ConnectionConfig): Promise<DatabaseSchema> {
    throw new Error('MySQLAdapter.loadSchema not yet implemented');
  }

  async testConnection(_config: ConnectionConfig): Promise<boolean> {
    throw new Error('MySQLAdapter.testConnection not yet implemented');
  }
}
