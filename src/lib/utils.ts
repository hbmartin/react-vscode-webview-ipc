/* eslint-disable no-console */
import type { ILogger } from './types';

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
export function createConsoleLogger(tag: string): ILogger {
  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      console.debug(`[${tag}] ${message}`, data),
    info: (message: string, data?: Record<string, unknown>) =>
      console.info(`[${tag}] ${message}`, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      console.warn(`[${tag}] ${message}`, data),
    error: (message: string, data?: Record<string, unknown>) =>
      console.error(`[${tag}] ${message}`, data),
    dispose: () => {},
  };
}
