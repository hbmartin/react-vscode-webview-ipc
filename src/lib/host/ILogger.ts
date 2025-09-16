/**
 * Interface for logging services that can be implemented
 * by both the extension host (Logger) and webview (WebviewLogger)
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
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
