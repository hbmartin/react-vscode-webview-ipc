import type { ClientCalls, HostCalls, VsCodeApi } from '../types';

/**
 * Context value interface providing type-safe API access
 */
export interface WebviewContextValue<T extends ClientCalls> {
  api: {
    [K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<T[K]>;
  };
  addListener: <E extends keyof HostCalls>(key: E, callback: HostCalls[E]) => void;
  removeListener: <E extends keyof HostCalls>(key: E, callback: HostCalls[E]) => void;
  isReady: boolean;
  vscode: VsCodeApi;
}
