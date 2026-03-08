import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { compareRequestSchema } from '@/lib/api/compareSchema';
import { applyOptions } from '@/lib/api/applyOptions';
import { getAdapter } from '@/lib/adapters';
import { diffSchemas } from '@/lib/diff';
import type { DiffResult } from '@/lib/types/diff';

export const runtime = 'nodejs'; // mysql2 and pg require Node.js — not edge-compatible

// ── Response shapes ────────────────────────────────────────────────────────

type ErrorCode = 'INVALID_INPUT' | 'CONNECTION_FAILED' | 'QUERY_FAILED' | 'TIMEOUT' | 'INTERNAL';

interface SuccessResponse {
  success: true;
  durationMs: number;
  result: DiffResult;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function errorResponse(message: string, code: ErrorCode, status: number): NextResponse {
  const body: ErrorResponse = { success: false, error: message, code };
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function noStoreHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  };
}

function classifyError(err: unknown): { message: string; code: ErrorCode; status: number } {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';

  if (msg.includes('connect') || msg.includes('refused') || msg.includes('timeout') || msg.includes('econnrefused')) {
    return { message: 'Failed to connect to database', code: 'CONNECTION_FAILED', status: 502 };
  }
  if (msg.includes('timeout')) {
    return { message: 'Connection timed out', code: 'TIMEOUT', status: 504 };
  }
  if (msg.includes('failed to load schema') || msg.includes('query')) {
    return { message: 'Failed to load schema', code: 'QUERY_FAILED', status: 502 };
  }
  return { message: 'Failed to compare schemas', code: 'INTERNAL', status: 500 };
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // 1. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Request body must be valid JSON', 'INVALID_INPUT', 400);
  }

  let parsed;
  try {
    parsed = compareRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const message = err.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return errorResponse(message, 'INVALID_INPUT', 400);
    }
    return errorResponse('Invalid request', 'INVALID_INPUT', 400);
  }

  const { reference, target, options = {} } = parsed;

  // 2. Resolve adapters
  const refAdapter = await getAdapter(reference.driver);
  const tgtAdapter = await getAdapter(target.driver);

  // 3. Test connections in parallel — fail fast before loading full schemas
  try {
    await Promise.all([
      refAdapter.testConnection(reference),
      tgtAdapter.testConnection(target),
    ]);
  } catch (err) {
    const { message, code, status } = classifyError(err);
    return errorResponse(message, code, status);
  }

  // 4. Load schemas in parallel
  let referenceSchema, targetSchema;
  try {
    [referenceSchema, targetSchema] = await Promise.all([
      refAdapter.loadSchema(reference),
      tgtAdapter.loadSchema(target),
    ]);
  } catch (err) {
    const { message, code, status } = classifyError(err);
    return errorResponse(message, code, status);
  }

  // 5. Diff and apply options
  const rawResult = diffSchemas(referenceSchema, targetSchema);
  const result = applyOptions(rawResult, options);

  const body_: SuccessResponse = {
    success: true,
    durationMs: Date.now() - start,
    result,
  };

  return NextResponse.json(body_, {
    status: 200,
    headers: noStoreHeaders(),
  });
}
