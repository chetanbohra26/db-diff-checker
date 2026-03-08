import { diffIndexes } from '../indexes';
import { makeTable } from './fixtures';
import type { IndexSchema } from '../../types/schema';

function idx(overrides: Partial<IndexSchema>): IndexSchema {
  return { name: 'idx', columns: ['id'], unique: false, primary: false, ...overrides };
}

describe('diffIndexes', () => {
  test('returns empty when indexes are identical', () => {
    const table = makeTable({
      indexes: { PRIMARY: idx({ name: 'PRIMARY', unique: true, primary: true }) },
    });
    expect(diffIndexes(table, table, 'users')).toEqual([]);
  });

  // ── Primary key ────────────────────────────────────────────────────────────

  test('detects primary key column mismatch', () => {
    const ref = makeTable({ indexes: { PRIMARY: idx({ name: 'PRIMARY', columns: ['id'], primary: true, unique: true }) } });
    const tgt = makeTable({ indexes: { users_pkey: idx({ name: 'users_pkey', columns: ['uuid'], primary: true, unique: true }) } });
    const result = diffIndexes(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'index_mismatch', field: 'columns' });
  });

  test('matches primary keys across different names (PRIMARY vs table_pkey)', () => {
    const pk = idx({ columns: ['id'], primary: true, unique: true });
    const ref = makeTable({ indexes: { PRIMARY: { ...pk, name: 'PRIMARY' } } });
    const tgt = makeTable({ indexes: { users_pkey: { ...pk, name: 'users_pkey' } } });
    expect(diffIndexes(ref, tgt, 'users')).toEqual([]);
  });

  test('reports missing primary key', () => {
    const ref = makeTable({ indexes: { PRIMARY: idx({ name: 'PRIMARY', primary: true, unique: true }) } });
    const tgt = makeTable({ indexes: {} });
    const result = diffIndexes(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'index_missing' });
  });

  // ── Non-primary indexes ────────────────────────────────────────────────────

  test('matches non-primary indexes by column signature regardless of name', () => {
    const ref = makeTable({ indexes: { email_idx: idx({ name: 'email_idx', columns: ['email'], unique: true }) } });
    const tgt = makeTable({ indexes: { ix_users_email: idx({ name: 'ix_users_email', columns: ['email'], unique: true }) } });
    expect(diffIndexes(ref, tgt, 'users')).toEqual([]);
  });

  test('detects missing non-primary index', () => {
    const ref = makeTable({ indexes: { email_idx: idx({ name: 'email_idx', columns: ['email'], unique: false }) } });
    const tgt = makeTable({ indexes: {} });
    const result = diffIndexes(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'index_missing', indexName: 'email_idx', severity: 'warning' });
  });

  test('detects extra index in target', () => {
    const ref = makeTable({ indexes: {} });
    const tgt = makeTable({ indexes: { extra_idx: idx({ name: 'extra_idx', columns: ['phone'] }) } });
    const result = diffIndexes(ref, tgt, 'users');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'index_extra', severity: 'info' });
  });

  test('treats same columns but different uniqueness as different signatures', () => {
    const ref = makeTable({ indexes: { email_idx: idx({ name: 'email_idx', columns: ['email'], unique: true }) } });
    const tgt = makeTable({ indexes: { email_idx: idx({ name: 'email_idx', columns: ['email'], unique: false }) } });
    // Unique:true vs Unique:false → different signatures → missing + extra
    const result = diffIndexes(ref, tgt, 'users');
    const kinds = result.map((d) => d.kind);
    expect(kinds).toContain('index_missing');
    expect(kinds).toContain('index_extra');
  });

  test('composite index: order of columns in signature is sorted', () => {
    const ref = makeTable({ indexes: { comp_idx: idx({ name: 'comp_idx', columns: ['b', 'a'], unique: false }) } });
    const tgt = makeTable({ indexes: { comp_idx: idx({ name: 'comp_idx', columns: ['a', 'b'], unique: false }) } });
    // Sorted signature makes ['b','a'] == ['a','b']
    expect(diffIndexes(ref, tgt, 'orders')).toEqual([]);
  });
});
