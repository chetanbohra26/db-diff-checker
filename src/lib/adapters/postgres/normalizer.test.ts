import { normalizePostgresType, normalizeDefault } from './normalizer';
import { normalizeMySQLType } from '../mysql/normalizer';

describe('normalizePostgresType', () => {
  // ── String types ───────────────────────────────────────────────────────────
  test('character varying with length → varchar(N)', () => {
    expect(normalizePostgresType('character varying', 'varchar', 255, null, null)).toBe('varchar(255)');
  });

  test('character varying without length → varchar', () => {
    expect(normalizePostgresType('character varying', 'varchar', null, null, null)).toBe('varchar');
  });

  test('character with length → char(N)', () => {
    expect(normalizePostgresType('character', 'bpchar', 10, null, null)).toBe('char(10)');
  });

  test('text → text', () => {
    expect(normalizePostgresType('text', 'text', null, null, null)).toBe('text');
  });

  // ── Integer types ──────────────────────────────────────────────────────────
  test('integer → int', () => {
    expect(normalizePostgresType('integer', 'int4', null, 32, 0)).toBe('int');
  });

  test('bigint → bigint', () => {
    expect(normalizePostgresType('bigint', 'int8', null, 64, 0)).toBe('bigint');
  });

  test('smallint → smallint', () => {
    expect(normalizePostgresType('smallint', 'int2', null, 16, 0)).toBe('smallint');
  });

  // ── Boolean ────────────────────────────────────────────────────────────────
  test('boolean → tinyint(1) for cross-DB compatibility', () => {
    expect(normalizePostgresType('boolean', 'bool', null, null, null)).toBe('tinyint(1)');
  });

  // ── Floating point ─────────────────────────────────────────────────────────
  test('real → float', () => {
    expect(normalizePostgresType('real', 'float4', null, null, null)).toBe('float');
  });

  test('double precision → double', () => {
    expect(normalizePostgresType('double precision', 'float8', null, null, null)).toBe('double');
  });

  // ── Decimal ────────────────────────────────────────────────────────────────
  test('numeric with precision and scale → decimal(P,S)', () => {
    expect(normalizePostgresType('numeric', 'numeric', null, 10, 2)).toBe('decimal(10,2)');
  });

  test('numeric without precision → decimal', () => {
    expect(normalizePostgresType('numeric', 'numeric', null, null, null)).toBe('decimal');
  });

  // ── Date / Time ────────────────────────────────────────────────────────────
  test('date → date', () => {
    expect(normalizePostgresType('date', 'date', null, null, null)).toBe('date');
  });

  test('timestamp without time zone → datetime', () => {
    expect(normalizePostgresType('timestamp without time zone', 'timestamp', null, null, null)).toBe('datetime');
  });

  test('timestamp with time zone → timestamp', () => {
    expect(normalizePostgresType('timestamp with time zone', 'timestamptz', null, null, null)).toBe('timestamp');
  });

  // ── JSON ───────────────────────────────────────────────────────────────────
  test('json → json', () => {
    expect(normalizePostgresType('json', 'json', null, null, null)).toBe('json');
  });

  test('jsonb → jsonb', () => {
    expect(normalizePostgresType('jsonb', 'jsonb', null, null, null)).toBe('jsonb');
  });

  // ── UUID ───────────────────────────────────────────────────────────────────
  test('uuid → varchar(36)', () => {
    expect(normalizePostgresType('uuid', 'uuid', null, null, null)).toBe('varchar(36)');
  });

  // ── Array ──────────────────────────────────────────────────────────────────
  test('array with _int4 udt → int[]', () => {
    expect(normalizePostgresType('array', '_int4', null, null, null)).toBe('int4[]');
  });

  test('array with _text udt → text[]', () => {
    expect(normalizePostgresType('array', '_text', null, null, null)).toBe('text[]');
  });

  // ── User-defined (enums) ───────────────────────────────────────────────────
  test('user-defined → udt_name (enum type name)', () => {
    expect(normalizePostgresType('user-defined', 'order_status', null, null, null)).toBe('order_status');
  });
});

describe('normalizeDefault (postgres)', () => {
  test('returns null for null', () => {
    expect(normalizeDefault(null)).toBeNull();
  });

  test('strips ::type cast suffix', () => {
    expect(normalizeDefault("'active'::character varying")).toBe('active');
  });

  test('strips ::text cast', () => {
    expect(normalizeDefault("'hello'::text")).toBe('hello');
  });

  test('normalizes now() to current_timestamp', () => {
    expect(normalizeDefault('now()')).toBe('current_timestamp');
  });

  test('normalizes CURRENT_TIMESTAMP to current_timestamp', () => {
    expect(normalizeDefault('CURRENT_TIMESTAMP')).toBe('current_timestamp');
  });

  test('strips nextval cast suffix', () => {
    // nextval stays as-is after cast removal — it's a sequence default, not a value
    expect(normalizeDefault("nextval('users_id_seq'::regclass)")).toBe(
      "nextval('users_id_seq')"
    );
  });

  test('handles boolean defaults', () => {
    expect(normalizeDefault('true')).toBe('true');
    expect(normalizeDefault('false')).toBe('false');
  });

  test('handles numeric defaults', () => {
    expect(normalizeDefault('0')).toBe('0');
    expect(normalizeDefault('42')).toBe('42');
  });
});

// ── Cross-DB type pair tests ───────────────────────────────────────────────
// These ensure that semantically equivalent types in MySQL and PostgreSQL
// normalize to the same canonical string, preventing false positive diffs.

describe('cross-DB type normalization parity', () => {
  test('varchar(255): pg character varying == mysql varchar(255)', () => {
    const pg = normalizePostgresType('character varying', 'varchar', 255, null, null);
    const my = normalizeMySQLType('varchar(255)');
    expect(pg).toBe(my);
  });

  test('char(10): pg character == mysql char(10)', () => {
    const pg = normalizePostgresType('character', 'bpchar', 10, null, null);
    const my = normalizeMySQLType('char(10)');
    expect(pg).toBe(my);
  });

  test('int: pg integer == mysql int(11)', () => {
    const pg = normalizePostgresType('integer', 'int4', null, 32, 0);
    const my = normalizeMySQLType('int(11)');
    expect(pg).toBe(my);
  });

  test('bigint: pg bigint == mysql bigint(20)', () => {
    const pg = normalizePostgresType('bigint', 'int8', null, 64, 0);
    const my = normalizeMySQLType('bigint(20)');
    expect(pg).toBe(my);
  });

  test('boolean: pg boolean == mysql tinyint(1)', () => {
    const pg = normalizePostgresType('boolean', 'bool', null, null, null);
    const my = normalizeMySQLType('tinyint(1)');
    expect(pg).toBe(my);
  });

  test('float: pg real == mysql float', () => {
    const pg = normalizePostgresType('real', 'float4', null, null, null);
    const my = normalizeMySQLType('float');
    expect(pg).toBe(my);
  });

  test('double: pg double precision == mysql double', () => {
    const pg = normalizePostgresType('double precision', 'float8', null, null, null);
    const my = normalizeMySQLType('double');
    expect(pg).toBe(my);
  });

  test('decimal(10,2): pg numeric == mysql decimal', () => {
    const pg = normalizePostgresType('numeric', 'numeric', null, 10, 2);
    const my = normalizeMySQLType('decimal(10,2)');
    expect(pg).toBe(my);
  });

  test('text: pg text == mysql text', () => {
    const pg = normalizePostgresType('text', 'text', null, null, null);
    const my = normalizeMySQLType('text');
    expect(pg).toBe(my);
  });

  test('json: pg json == mysql json', () => {
    const pg = normalizePostgresType('json', 'json', null, null, null);
    const my = normalizeMySQLType('json');
    expect(pg).toBe(my);
  });

  test('date: pg date == mysql date', () => {
    const pg = normalizePostgresType('date', 'date', null, null, null);
    const my = normalizeMySQLType('date');
    expect(pg).toBe(my);
  });
});
