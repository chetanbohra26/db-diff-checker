/**
 * Strips sensitive connection details from error messages before they are
 * surfaced to callers or logs. Passwords, hostnames, and connection strings
 * must never appear in user-facing errors.
 */
export function sanitizeError(err: unknown, fallbackMessage: string): Error {
  // Always return a fresh Error with a safe message — never forward the
  // original message, which may contain host/password from the connection config.
  const safe = new Error(fallbackMessage);

  // Preserve the stack trace shape for debugging without leaking message content
  if (err instanceof Error && err.stack) {
    safe.stack = safe.stack?.replace(safe.message, fallbackMessage);
  }

  return safe;
}
