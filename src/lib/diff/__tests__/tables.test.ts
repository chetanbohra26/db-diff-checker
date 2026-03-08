import { diffTablesMissing, diffTablesExtra } from '../tables';
import { makeSchema, makeTable } from './fixtures';

describe('diffTablesMissing', () => {
  test('returns empty when schemas are identical', () => {
    const schema = makeSchema({ users: makeTable({ name: 'users' }) });
    expect(diffTablesMissing(schema, schema)).toEqual([]);
  });

  test('detects tables in reference missing from target', () => {
    const ref = makeSchema({ users: makeTable({ name: 'users' }), orders: makeTable({ name: 'orders' }) });
    const tgt = makeSchema({ users: makeTable({ name: 'users' }) });
    const result = diffTablesMissing(ref, tgt);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'table_missing', table: 'orders', severity: 'error' });
  });

  test('returns empty when target has extra tables (not missing)', () => {
    const ref = makeSchema({ users: makeTable({ name: 'users' }) });
    const tgt = makeSchema({ users: makeTable({ name: 'users' }), orders: makeTable({ name: 'orders' }) });
    expect(diffTablesMissing(ref, tgt)).toEqual([]);
  });

  test('reports multiple missing tables', () => {
    const ref = makeSchema({ a: makeTable({ name: 'a' }), b: makeTable({ name: 'b' }), c: makeTable({ name: 'c' }) });
    const tgt = makeSchema({});
    const result = diffTablesMissing(ref, tgt);
    expect(result).toHaveLength(3);
    expect(result.every((d) => d.kind === 'table_missing')).toBe(true);
  });
});

describe('diffTablesExtra', () => {
  test('returns empty when schemas are identical', () => {
    const schema = makeSchema({ users: makeTable({ name: 'users' }) });
    expect(diffTablesExtra(schema, schema)).toEqual([]);
  });

  test('detects tables in target not in reference', () => {
    const ref = makeSchema({ users: makeTable({ name: 'users' }) });
    const tgt = makeSchema({ users: makeTable({ name: 'users' }), logs: makeTable({ name: 'logs' }) });
    const result = diffTablesExtra(ref, tgt);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'table_extra', table: 'logs', severity: 'warning' });
  });
});
