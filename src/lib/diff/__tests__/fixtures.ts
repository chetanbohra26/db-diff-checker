import type { DatabaseSchema, TableSchema } from '../../types/schema';

/** Minimal table builder for tests */
export function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    name: 'test',
    columns: {},
    indexes: {},
    foreignKeys: {},
    ...overrides,
  };
}

/** Minimal schema builder for tests */
export function makeSchema(tables: Record<string, TableSchema> = {}): DatabaseSchema {
  return { tables, driver: 'mysql' };
}

/** A representative "reference" schema used across multiple test files */
export const referenceSchema: DatabaseSchema = {
  driver: 'mysql',
  tables: {
    users: {
      name: 'users',
      columns: {
        id: { name: 'id', type: 'int', nullable: false, default: null, extra: 'auto_increment', enumValues: null },
        email: { name: 'email', type: 'varchar(255)', nullable: false, default: null, extra: null, enumValues: null },
        status: { name: 'status', type: "enum('active','inactive')", nullable: false, default: 'active', extra: null, enumValues: ['active', 'inactive'] },
        created_at: { name: 'created_at', type: 'datetime', nullable: false, default: 'current_timestamp', extra: null, enumValues: null },
      },
      indexes: {
        PRIMARY: { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
        users_email_idx: { name: 'users_email_idx', columns: ['email'], unique: true, primary: false },
      },
      foreignKeys: {},
    },
    orders: {
      name: 'orders',
      columns: {
        id: { name: 'id', type: 'int', nullable: false, default: null, extra: 'auto_increment', enumValues: null },
        user_id: { name: 'user_id', type: 'int', nullable: false, default: null, extra: null, enumValues: null },
        total: { name: 'total', type: 'decimal(10,2)', nullable: false, default: null, extra: null, enumValues: null },
      },
      indexes: {
        PRIMARY: { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
        orders_user_idx: { name: 'orders_user_idx', columns: ['user_id'], unique: false, primary: false },
      },
      foreignKeys: {
        fk_orders_user: {
          name: 'fk_orders_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        },
      },
    },
  },
};
