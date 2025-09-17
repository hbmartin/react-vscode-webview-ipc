import type { VsCodeApi } from '../types';
import { LogLevel, type ILogger } from './ILogger';

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

export class WebviewLogger implements ILogger {
  constructor(
    private readonly vscode: VsCodeApi,
    readonly tag: string
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.vscode.postMessage({
      type: 'log',
      level: LogLevel.DEBUG,
      message: `[${this.tag}] ${message}`,
      data,
    } satisfies LogMessage);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.vscode.postMessage({
      type: 'log',
      level: LogLevel.INFO,
      message: `[${this.tag}] ${message}`,
      data,
    } satisfies LogMessage);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.vscode.postMessage({
      type: 'log',
      level: LogLevel.WARN,
      message: `[${this.tag}] ${message}`,
      data,
    } satisfies LogMessage);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.vscode.postMessage({
      type: 'log',
      level: LogLevel.ERROR,
      message: `[${this.tag}] ${message}`,
      data,
    } satisfies LogMessage);
  }

  dispose(): void {
    // No resources to dispose in webview context
    // The actual output channel is managed by the extension host Logger
  }
}
