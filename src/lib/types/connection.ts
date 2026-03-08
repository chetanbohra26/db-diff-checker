export type DatabaseDriver = 'mysql' | 'postgres';

export interface ConnectionConfig {
  driver: DatabaseDriver;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string; // never persisted — in-memory during request lifetime only
  ssl?: boolean;
  schema?: string; // postgres: defaults to 'public'; mysql: uses database name
  connectTimeoutMs?: number;
}
