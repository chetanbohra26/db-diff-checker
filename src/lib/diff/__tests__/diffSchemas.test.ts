import { diffSchemas } from '../index';
import { makeSchema, makeTable, referenceSchema } from './fixtures';

describe('diffSchemas', () => {
  test('returns zero diffs for identical schemas', () => {
    const result = diffSchemas(referenceSchema, referenceSchema);
    expect(result.summary.totalDiffs).toBe(0);
    expect(result.tablesMissing).toHaveLength(0);
    expect(result.tablesExtra).toHaveLength(0);
    expect(result.columnDiffs).toHaveLength(0);
    expect(result.enumDiffs).toHaveLength(0);
    expect(result.indexDiffs).toHaveLength(0);
    expect(result.foreignKeyDiffs).toHaveLength(0);
  });

  test('returns zero diffs for empty schemas', () => {
    const empty = makeSchema({});
    const result = diffSchemas(empty, empty);
    expect(result.summary.totalDiffs).toBe(0);
  });

  test('summary counts are consistent with diff arrays', () => {
    const ref = makeSchema({ users: referenceSchema.tables.users });
    const tgt = makeSchema({});
    const result = diffSchemas(ref, tgt);
    expect(result.summary.missingTables).toBe(result.tablesMissing.length);
    expect(result.summary.extraTables).toBe(result.tablesExtra.length);
    expect(result.summary.totalDiffs).toBe(
      result.tablesMissing.length +
        result.tablesExtra.length +
        result.columnDiffs.length +
        result.enumDiffs.length +
        result.indexDiffs.length +
        result.foreignKeyDiffs.length
    );
  });

  test('detects all 7 diff types in one comparison', () => {
    const ref = makeSchema({
      users: {
        name: 'users',
        columns: {
          id:     { name: 'id', type: 'int', nullable: false, default: null, extra: null, enumValues: null },
          email:  { name: 'email', type: 'varchar(255)', nullable: false, default: null, extra: null, enumValues: null },
          status: { name: 'status', type: "enum('active','inactive')", nullable: false, default: null, extra: null, enumValues: ['active', 'inactive'] },
          phone:  { name: 'phone', type: 'varchar(20)', nullable: true, default: null, extra: null, enumValues: null },
        },
        indexes: {
          PRIMARY:   { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
          email_idx: { name: 'email_idx', columns: ['email'], unique: true, primary: false },
        },
        foreignKeys: {
          fk_users_org: {
            name: 'fk_users_org',
            columns: ['org_id'],
            referencedTable: 'orgs',
            referencedColumns: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'NO ACTION',
          },
        },
      },
      archive: { name: 'archive', columns: {}, indexes: {}, foreignKeys: {} }, // will be missing
    });

    const tgt = makeSchema({
      users: {
        name: 'users',
        columns: {
          id:     { name: 'id', type: 'int', nullable: false, default: null, extra: null, enumValues: null },
          email:  { name: 'email', type: 'varchar(100)', nullable: false, default: null, extra: null, enumValues: null }, // type mismatch
          status: { name: 'status', type: "enum('active')", nullable: false, default: null, extra: null, enumValues: ['active'] }, // enum mismatch
          // phone missing
          bio:    { name: 'bio', type: 'text', nullable: true, default: null, extra: null, enumValues: null }, // extra
        },
        indexes: {
          PRIMARY: { name: 'PRIMARY', columns: ['id'], unique: true, primary: true },
          // email_idx missing
        },
        foreignKeys: {
          // fk_users_org missing
        },
      },
      logs: { name: 'logs', columns: {}, indexes: {}, foreignKeys: {} }, // extra table
    });

    const result = diffSchemas(ref, tgt);

    // 1. Missing table
    expect(result.tablesMissing.map((d) => d.table)).toContain('archive');
    // 2. Extra table
    expect(result.tablesExtra.map((d) => d.table)).toContain('logs');
    // 3. Missing column
    expect(result.columnDiffs.some((d) => d.kind === 'column_missing' && d.column === 'phone')).toBe(true);
    // 4. Extra column
    expect(result.columnDiffs.some((d) => d.kind === 'column_extra' && d.column === 'bio')).toBe(true);
    // 5. Column type mismatch
    expect(result.columnDiffs.some((d) => d.kind === 'column_type_mismatch' && d.column === 'email')).toBe(true);
    // 6. Enum mismatch
    expect(result.enumDiffs.some((d) => d.column === 'status' && d.missingValues.includes('inactive'))).toBe(true);
    // 7. Missing index
    expect(result.indexDiffs.some((d) => d.kind === 'index_missing' && d.indexName === 'email_idx')).toBe(true);
    // 8. Missing FK
    expect(result.foreignKeyDiffs.some((d) => d.kind === 'fk_missing')).toBe(true);
  });

  test('does not diff internals of missing tables', () => {
    const ref = makeSchema({
      users: referenceSchema.tables.users,
      orders: referenceSchema.tables.orders,
    });
    const tgt = makeSchema({
      users: referenceSchema.tables.users,
      // orders missing entirely
    });
    const result = diffSchemas(ref, tgt);
    // Should report table missing, not column diffs for orders
    expect(result.tablesMissing.some((d) => d.table === 'orders')).toBe(true);
    expect(result.columnDiffs.some((d) => d.table === 'orders')).toBe(false);
  });

  test('summary tablesChecked counts only common tables', () => {
    const ref = makeSchema({
      a: makeTable({ name: 'a' }),
      b: makeTable({ name: 'b' }),
      c: makeTable({ name: 'c' }),
    });
    const tgt = makeSchema({
      b: makeTable({ name: 'b' }),
      c: makeTable({ name: 'c' }),
      d: makeTable({ name: 'd' }),
    });
    const result = diffSchemas(ref, tgt);
    expect(result.summary.tablesChecked).toBe(2); // b and c
    expect(result.summary.missingTables).toBe(1);  // a
    expect(result.summary.extraTables).toBe(1);    // d
  });

  test('severity counts match diff arrays', () => {
    const result = diffSchemas(referenceSchema, makeSchema({}));
    const errors = [
      ...result.tablesMissing,
      ...result.tablesExtra,
      ...result.columnDiffs,
      ...result.enumDiffs,
      ...result.indexDiffs,
      ...result.foreignKeyDiffs,
    ].filter((d) => d.severity === 'error').length;
    expect(result.summary.errors).toBe(errors);
  });
});
