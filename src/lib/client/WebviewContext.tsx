import { createContext } from 'react';
import type { ClientCalls, HostCalls, VsCodeApi } from '../types';

/**
 * Context value interface providing type-safe API access
 */
export interface WebviewContextValue {
  api: {
    [K in keyof ClientCalls]: (...args: Parameters<ClientCalls[K]>) => ReturnType<ClientCalls[K]>;
  };
  addListener: <E extends keyof HostCalls>(key: E, callback: HostCalls[E]) => void;
  removeListener: <E extends keyof HostCalls>(key: E, callback: HostCalls[E]) => void;
  isReady: boolean;
  vscode: VsCodeApi;
}

export const WebviewContext = createContext<WebviewContextValue | undefined>(undefined);
