import { LogLevel, type ILogger, type LogMessage } from '../types';
import type { VsCodeApi } from './types';

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
