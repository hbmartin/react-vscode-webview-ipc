import { useContext, useMemo } from 'react';
import { WebviewLogger } from '../host/WebviewLogger';
import { WebviewContext } from './WebviewContext';
import type { ILogger } from '../host/ILogger';

/**
 * React hook to get a logger instance for use in webview components.
 * The logger automatically sends all log messages to the extension host
 * where they are written to the VS Code output channel.
 */
export function useLogger(tag: string): ILogger {
  const context = useContext(WebviewContext);
  return useMemo(
    () =>
      context?.vscode === undefined
        ? createConsoleLogger(tag)
        : new WebviewLogger(context.vscode, tag),
    [context?.vscode, tag]
  );
}

function createConsoleLogger(tag: string): ILogger {
  return {
    debug: (message: string, data?: Record<any, any>) => console.debug(`[${tag}] ${message}`, data),
    info: (message: string, data?: Record<any, any>) => console.info(`[${tag}] ${message}`, data),
    warn: (message: string, data?: Record<any, any>) => console.warn(`[${tag}] ${message}`, data),
    error: (message: string, data?: Record<any, any>) => console.error(`[${tag}] ${message}`, data),
    dispose: () => {},
  };
}
