import { normalizeMySQLType, parseEnumValues, normalizeDefault } from './normalizer';

describe('normalizeMySQLType', () => {
  // ── Integer display-width stripping ──────────────────────────────────────
  test('strips int display width', () => {
    expect(normalizeMySQLType('int(11)')).toBe('int');
  });

  test('strips bigint display width', () => {
    expect(normalizeMySQLType('bigint(20)')).toBe('bigint');
  });

  test('strips smallint display width', () => {
    expect(normalizeMySQLType('smallint(6)')).toBe('smallint');
  });

  test('strips mediumint display width', () => {
    expect(normalizeMySQLType('mediumint(8)')).toBe('mediumint');
  });

  test('strips tinyint display width except tinyint(1)', () => {
    expect(normalizeMySQLType('tinyint(4)')).toBe('tinyint');
  });

  test('preserves tinyint(1) — boolean convention', () => {
    expect(normalizeMySQLType('tinyint(1)')).toBe('tinyint(1)');
  });

  test('preserves tinyint(1) unsigned — unsigned boolean', () => {
    expect(normalizeMySQLType('tinyint(1) unsigned')).toBe('tinyint(1) unsigned');
  });

  test('handles unsigned int', () => {
    expect(normalizeMySQLType('int(10) unsigned')).toBe('int unsigned');
  });

  test('handles unsigned bigint', () => {
    expect(normalizeMySQLType('bigint(20) unsigned')).toBe('bigint unsigned');
  });

  // ── Varchar / Char — length preserved ────────────────────────────────────
  test('preserves varchar length', () => {
    expect(normalizeMySQLType('varchar(255)')).toBe('varchar(255)');
  });

  test('preserves char length', () => {
    expect(normalizeMySQLType('char(10)')).toBe('char(10)');
  });

  // ── Decimal precision preserved ───────────────────────────────────────────
  test('preserves decimal precision and scale', () => {
    expect(normalizeMySQLType('decimal(10,2)')).toBe('decimal(10,2)');
  });

  test('strips decimal zerofill', () => {
    expect(normalizeMySQLType('decimal(10,2) zerofill')).toBe('decimal(10,2)');
  });

  test('preserves decimal unsigned qualifier', () => {
    expect(normalizeMySQLType('decimal(10,2) unsigned')).toBe('decimal(10,2) unsigned');
  });

  test('strips decimal unsigned zerofill — keeps unsigned, drops zerofill', () => {
    expect(normalizeMySQLType('decimal(10,2) unsigned zerofill')).toBe('decimal(10,2) unsigned');
  });

  // ── Case normalization ────────────────────────────────────────────────────
  test('lowercases plain types', () => {
    expect(normalizeMySQLType('TEXT')).toBe('text');
    expect(normalizeMySQLType('DATETIME')).toBe('datetime');
    expect(normalizeMySQLType('JSON')).toBe('json');
  });

  // ── Enum ─────────────────────────────────────────────────────────────────
  test('normalizes enum to lowercase keyword with values', () => {
    expect(normalizeMySQLType("ENUM('active','inactive')")).toBe("enum('active','inactive')");
  });

  test('normalizes set type', () => {
    expect(normalizeMySQLType("SET('a','b','c')")).toBe("set('a','b','c')");
  });

  test('re-escapes single quotes inside enum values', () => {
    expect(normalizeMySQLType("ENUM('it''s','fine')")).toBe("enum('it''s','fine')");
  });

  test('re-escapes single quotes inside set values', () => {
    expect(normalizeMySQLType("SET('it''s','ok')")).toBe("set('it''s','ok')");
  });
});

describe('parseEnumValues', () => {
  test('parses simple enum values', () => {
    expect(parseEnumValues("'active','inactive','pending'")).toEqual([
      'active',
      'inactive',
      'pending',
    ]);
  });

  test('parses single value', () => {
    expect(parseEnumValues("'only'")).toEqual(['only']);
  });

  test('handles values with spaces', () => {
    expect(parseEnumValues("'in progress','not started','done'")).toEqual([
      'in progress',
      'not started',
      'done',
    ]);
  });

  test("handles escaped quotes with ''", () => {
    expect(parseEnumValues("'it''s','fine'")).toEqual(["it's", 'fine']);
  });

  test("handles escaped quotes with \\'", () => {
    expect(parseEnumValues("'it\\'s','fine'")).toEqual(["it's", 'fine']);
  });
});

describe('normalizeDefault', () => {
  test('returns null for null input', () => {
    expect(normalizeDefault(null)).toBeNull();
  });

  test('lowercases unquoted SQL expression defaults', () => {
    expect(normalizeDefault('ACTIVE')).toBe('active');
  });

  test('preserves quoted string defaults exactly as-is (case-sensitive)', () => {
    expect(normalizeDefault("'hello'")).toBe("'hello'");
    expect(normalizeDefault("'ACTIVE'")).toBe("'ACTIVE'");
    expect(normalizeDefault("'Hello World'")).toBe("'Hello World'");
  });

  test('normalizes now() to current_timestamp', () => {
    expect(normalizeDefault('now()')).toBe('current_timestamp');
  });

  test('normalizes CURRENT_TIMESTAMP() to current_timestamp', () => {
    expect(normalizeDefault('CURRENT_TIMESTAMP()')).toBe('current_timestamp');
  });

  test('preserves current_timestamp as-is', () => {
    expect(normalizeDefault('CURRENT_TIMESTAMP')).toBe('current_timestamp');
  });

  test('normalizes numeric defaults', () => {
    expect(normalizeDefault('0')).toBe('0');
    expect(normalizeDefault('1')).toBe('1');
  });

  test('trims whitespace', () => {
    expect(normalizeDefault('  hello  ')).toBe('hello');
  });
});
