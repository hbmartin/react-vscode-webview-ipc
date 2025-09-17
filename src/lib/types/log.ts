/**
 * Interface for logging services that can be implemented
 * by both the extension host (Logger) and webview (WebviewLogger)
 */

export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  dispose(): void;
}

export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR,
}

export interface LogMessage {
  type: 'log';
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

export function isLogMessage(value: unknown): value is LogMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (!('type' in value) || value.type !== 'log') {
    return false;
  }
  if (!('level' in value) || typeof value.level !== 'number') {
    return false;
  }
  if (!('message' in value) || typeof value.message !== 'string') {
    return false;
  }
  return true;
}
