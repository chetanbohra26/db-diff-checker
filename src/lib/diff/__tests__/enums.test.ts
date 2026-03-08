import { diffEnums } from '../enums';
import { makeTable } from './fixtures';
import type { ColumnSchema } from '../../types/schema';

function enumCol(values: string[]): ColumnSchema {
  return {
    name: 'status',
    type: `enum(${values.map((v) => `'${v}'`).join(',')})`,
    nullable: false,
    default: null,
    extra: null,
    enumValues: values,
  };
}

describe('diffEnums', () => {
  test('returns empty when enum values are identical', () => {
    const table = makeTable({ columns: { status: enumCol(['active', 'inactive']) } });
    expect(diffEnums(table, table, 'users')).toEqual([]);
  });

  test('detects missing enum value', () => {
    const ref = makeTable({ columns: { status: enumCol(['active', 'inactive', 'pending']) } });
    const tgt = makeTable({ columns: { status: enumCol(['active', 'inactive']) } });
    const result = diffEnums(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'enum_mismatch',
      column: 'status',
      missingValues: ['pending'],
      extraValues: [],
      severity: 'error',
    });
  });

  test('detects extra enum value in target', () => {
    const ref = makeTable({ columns: { status: enumCol(['active', 'inactive']) } });
    const tgt = makeTable({ columns: { status: enumCol(['active', 'inactive', 'banned']) } });
    const result = diffEnums(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'enum_mismatch',
      missingValues: [],
      extraValues: ['banned'],
    });
  });

  test('detects both missing and extra values simultaneously', () => {
    const ref = makeTable({ columns: { status: enumCol(['active', 'inactive', 'pending']) } });
    const tgt = makeTable({ columns: { status: enumCol(['active', 'inactive', 'archived']) } });
    const result = diffEnums(ref, tgt, 'users');
    expect(result[0].missingValues).toEqual(['pending']);
    expect(result[0].extraValues).toEqual(['archived']);
  });

  test('skips non-enum columns', () => {
    const ref = makeTable({ columns: { email: { name: 'email', type: 'varchar(255)', nullable: false, default: null, extra: null, enumValues: null } } });
    const tgt = makeTable({ columns: { email: { name: 'email', type: 'varchar(100)', nullable: false, default: null, extra: null, enumValues: null } } });
    expect(diffEnums(ref, tgt, 'users')).toEqual([]);
  });

  test('skips column missing from target — handled by diffColumns', () => {
    const ref = makeTable({ columns: { status: enumCol(['active']) } });
    const tgt = makeTable({ columns: {} });
    expect(diffEnums(ref, tgt, 'users')).toEqual([]);
  });
});
