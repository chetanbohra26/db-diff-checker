export interface ColumnSchema {
  name: string;
  type: string;            // normalized canonical type, e.g. "varchar(255)", "int", "text"
  nullable: boolean;
  default: string | null;  // null = no default; always coerced to string for comparison
  extra: string | null;    // e.g. "auto_increment", "on update current_timestamp"
  enumValues: string[] | null; // non-null only when column is an enum type
}

export interface IndexSchema {
  name: string;
  columns: string[];       // ordered by key sequence position
  unique: boolean;
  primary: boolean;        // true for primary key indexes
}

export interface ForeignKeySchema {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;        // 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate: string;
}

export interface TableSchema {
  name: string;
  columns: Record<string, ColumnSchema>;      // keyed by column name (lowercase)
  indexes: Record<string, IndexSchema>;       // keyed by index name
  foreignKeys: Record<string, ForeignKeySchema>; // keyed by constraint name
}

export interface DatabaseSchema {
  tables: Record<string, TableSchema>;        // keyed by table name (lowercase)
  driver: string;                             // 'mysql' | 'postgres' — for diagnostics
}
