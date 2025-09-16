/**
 * Generate a unique ID for requests
 */
export function generateId(prefix: string): string {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, sonarjs/pseudo-random, code-complete/no-magic-numbers-except-zero-one
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
