import { z } from 'zod';

const connectionConfigSchema = z.object({
  driver: z.enum(['mysql', 'postgres']),
  host: z.string().min(1, 'host is required'),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1, 'database is required'),
  username: z.string().min(1, 'username is required'),
  password: z.string(),
  ssl: z.boolean().optional(),
  schema: z.string().optional(),
  connectTimeoutMs: z.number().int().positive().optional(),
});

const compareOptionsSchema = z.object({
  ignoreExtraTables: z.boolean().optional(),
  ignoreExtraColumns: z.boolean().optional(),
  ignoreIndexes: z.boolean().optional(),
  ignoreForeignKeys: z.boolean().optional(),
  ignoreDefaults: z.boolean().optional(),
});

export const compareRequestSchema = z.object({
  reference: connectionConfigSchema,
  target: connectionConfigSchema,
  options: compareOptionsSchema.optional(),
});

export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type CompareOptions = z.infer<typeof compareOptionsSchema>;
