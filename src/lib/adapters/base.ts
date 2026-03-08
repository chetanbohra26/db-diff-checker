import type { ConnectionConfig } from '../types/connection';
import type { DatabaseSchema } from '../types/schema';

export interface SchemaAdapter {
  /**
   * Load the full schema for the given database using bulk queries.
   * Must close its connection before returning.
   * Must never include passwords in thrown error messages.
   */
  loadSchema(config: ConnectionConfig): Promise<DatabaseSchema>;

  /**
   * Verify credentials are valid. Returns true on success.
   * Throws a sanitized Error on failure (no password in message).
   */
  testConnection(config: ConnectionConfig): Promise<boolean>;
}
