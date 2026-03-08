import { diffColumns } from '../columns';
import { makeTable } from './fixtures';
import type { ColumnSchema } from '../../types/schema';

function col(overrides: Partial<ColumnSchema> = {}): ColumnSchema {
  return {
    name: 'col',
    type: 'varchar(255)',
    nullable: false,
    default: null,
    extra: null,
    enumValues: null,
    ...overrides,
  };
}

describe('diffColumns', () => {
  test('returns empty when columns are identical', () => {
    const table = makeTable({ columns: { email: col({ name: 'email' }) } });
    expect(diffColumns(table, table, 'users')).toEqual([]);
  });

  test('detects missing column', () => {
    const ref = makeTable({ columns: { email: col({ name: 'email' }), phone: col({ name: 'phone' }) } });
    const tgt = makeTable({ columns: { email: col({ name: 'email' }) } });
    const result = diffColumns(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'column_missing', table: 'users', column: 'phone', severity: 'error' });
  });

  test('detects extra column', () => {
    const ref = makeTable({ columns: { email: col({ name: 'email' }) } });
    const tgt = makeTable({ columns: { email: col({ name: 'email' }), phone: col({ name: 'phone' }) } });
    const result = diffColumns(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'column_extra', table: 'users', column: 'phone', severity: 'warning' });
  });

  test('detects type mismatch', () => {
    const ref = makeTable({ columns: { email: col({ type: 'varchar(255)' }) } });
    const tgt = makeTable({ columns: { email: col({ type: 'varchar(100)' }) } });
    const result = diffColumns(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'column_type_mismatch',
      referenceType: 'varchar(255)',
      targetType: 'varchar(100)',
      severity: 'error',
    });
  });

  test('detects nullable mismatch', () => {
    const ref = makeTable({ columns: { email: col({ nullable: false }) } });
    const tgt = makeTable({ columns: { email: col({ nullable: true }) } });
    const result = diffColumns(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'column_nullable_mismatch',
      referenceNullable: false,
      targetNullable: true,
      severity: 'warning',
    });
  });

  test('detects default mismatch', () => {
    const ref = makeTable({ columns: { count: col({ default: '0' }) } });
    const tgt = makeTable({ columns: { count: col({ default: null }) } });
    const result = diffColumns(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'column_default_mismatch',
      referenceDefault: '0',
      targetDefault: null,
      severity: 'info',
    });
  });

  test('skips type comparison for enum columns — handled by diffEnums', () => {
    const ref = makeTable({ columns: { status: col({ type: "enum('a','b')", enumValues: ['a', 'b'] }) } });
    const tgt = makeTable({ columns: { status: col({ type: "enum('a')", enumValues: ['a'] }) } });
    const result = diffColumns(ref, tgt, 'orders');
    // Should NOT produce a type mismatch — that's diffEnums' job
    expect(result.some((d) => d.kind === 'column_type_mismatch')).toBe(false);
  });

  test('can report multiple diff kinds on the same column', () => {
    const ref = makeTable({ columns: { val: col({ type: 'int', nullable: false, default: '0' }) } });
    const tgt = makeTable({ columns: { val: col({ type: 'bigint', nullable: true, default: null }) } });
    const result = diffColumns(ref, tgt, 'tbl');
    const kinds = result.map((d) => d.kind);
    expect(kinds).toContain('column_type_mismatch');
    expect(kinds).toContain('column_nullable_mismatch');
    expect(kinds).toContain('column_default_mismatch');
  });
});
