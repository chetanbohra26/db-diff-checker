import { diffForeignKeys } from '../foreignKeys';
import { makeTable } from './fixtures';
import type { ForeignKeySchema } from '../../types/schema';

function fk(overrides: Partial<ForeignKeySchema> = {}): ForeignKeySchema {
  return {
    name: 'fk_orders_user',
    columns: ['user_id'],
    referencedTable: 'users',
    referencedColumns: ['id'],
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
    ...overrides,
  };
}

describe('diffForeignKeys', () => {
  test('returns empty when FKs are identical', () => {
    const table = makeTable({ foreignKeys: { fk_orders_user: fk() } });
    expect(diffForeignKeys(table, table, 'orders')).toEqual([]);
  });

  test('matches FKs by structural signature, not constraint name', () => {
    const ref = makeTable({ foreignKeys: { fk_orders_user: fk({ name: 'fk_orders_user' }) } });
    const tgt = makeTable({ foreignKeys: { orders_user_id_fkey: fk({ name: 'orders_user_id_fkey' }) } });
    expect(diffForeignKeys(ref, tgt, 'orders')).toEqual([]);
  });

  test('detects missing FK', () => {
    const ref = makeTable({ foreignKeys: { fk_orders_user: fk() } });
    const tgt = makeTable({ foreignKeys: {} });
    const result = diffForeignKeys(ref, tgt, 'orders');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'fk_missing', severity: 'error' });
  });

  test('detects extra FK in target', () => {
    const ref = makeTable({ foreignKeys: {} });
    const tgt = makeTable({ foreignKeys: { fk_orders_user: fk() } });
    const result = diffForeignKeys(ref, tgt, 'orders');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'fk_extra', severity: 'warning' });
  });

  test('detects onDelete mismatch', () => {
    const ref = makeTable({ foreignKeys: { fk: fk({ onDelete: 'CASCADE' }) } });
    const tgt = makeTable({ foreignKeys: { fk: fk({ onDelete: 'SET NULL' }) } });
    const result = diffForeignKeys(ref, tgt, 'orders');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'fk_mismatch',
      field: 'onDelete',
      referenceValue: 'CASCADE',
      targetValue: 'SET NULL',
      severity: 'error',
    });
  });

  test('detects onUpdate mismatch', () => {
    const ref = makeTable({ foreignKeys: { fk: fk({ onUpdate: 'CASCADE' }) } });
    const tgt = makeTable({ foreignKeys: { fk: fk({ onUpdate: 'RESTRICT' }) } });
    const result = diffForeignKeys(ref, tgt, 'orders');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'fk_mismatch', field: 'onUpdate' });
  });

  test('detects both onDelete and onUpdate mismatches', () => {
    const ref = makeTable({ foreignKeys: { fk: fk({ onDelete: 'CASCADE', onUpdate: 'CASCADE' }) } });
    const tgt = makeTable({ foreignKeys: { fk: fk({ onDelete: 'RESTRICT', onUpdate: 'RESTRICT' }) } });
    const result = diffForeignKeys(ref, tgt, 'orders');
    expect(result).toHaveLength(2);
  });
});
