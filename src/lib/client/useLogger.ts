/* eslint-disable no-console */
import { useMemo } from 'react';
import type { ILogger } from '../types';
import { WebviewLogger } from './WebviewLogger';
import type { VsCodeApi } from './types';

/**
 * React hook to get a logger instance for use in webview components.
 * The logger automatically sends all log messages to the extension host
 * where they are written to the VS Code output channel.
 */
export function useLogger(tag: string, vscode?: VsCodeApi): ILogger {
  return useMemo(
    () => (vscode === undefined ? createConsoleLogger(tag) : new WebviewLogger(vscode, tag)),
    [vscode, tag]
  );
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
