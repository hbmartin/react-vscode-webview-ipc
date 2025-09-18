import { useMemo } from 'react';
import type { ILogger } from '../types';
import { createConsoleLogger } from '../utils';
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
