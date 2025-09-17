/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import {
  isViewApiError,
  isViewApiEvent,
  isViewApiResponse,
  type ClientCalls,
  type HostCalls,
  type RequestContext,
  type ViewApiRequest,
  type VsCodeApi,
} from '../types';
import { generateId } from '../utils';
import { DeferredPromise, type WebviewContextValue } from './types';

declare function acquireVsCodeApi(): VsCodeApi;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const vscodeApi = acquireVsCodeApi();

interface WebviewProviderProps {
  viewType: string;
  children: React.ReactNode;
}

/**
 * WebviewProvider provides type-safe API access to webview components
 */
export const WebviewProvider: React.FC<WebviewProviderProps> = ({ children, viewType }) => {
  const pendingRequests = useRef<Map<string, DeferredPromise<any>>>(new Map());
  const listeners = useRef<Map<keyof HostCalls, Set<(...args: any[]) => void>>>(new Map());

  // Generate context for this webview instance
  const contextRef = useRef<RequestContext>({
    viewId: generateId('webview'),
    viewType: viewType,
    timestamp: Date.now(),
    sessionId: generateId('session'),
  });

  /**
   * Type-safe API caller with request/response matching
   */
  const callApi = <K extends keyof ClientCalls>(
    key: K,
    ...params: Parameters<ClientCalls[K]>
  ): ReturnType<ClientCalls[K]> => {
    const id = generateId('req');
    const deferred = new DeferredPromise<Awaited<ReturnType<ClientCalls[K]>>>(key);

    const request: ViewApiRequest<K> = {
      type: 'request',
      id,
      key,
      params,
      context: contextRef.current,
    };

    pendingRequests.current.set(id, deferred);

    // Send the request
    // eslint-disable-next-line sonarjs/no-try-promise
    try {
      vscodeApi.postMessage(request);
    } catch (error) {
      console.error(`Failed to send API request ${key}:`, error);
      deferred.clearTimeout();
      pendingRequests.current.delete(id);
      deferred.reject(error instanceof Error ? error : new Error(String(error)));
    }

    return deferred.promise;
  };

  /**
   * Create typed API object using Proxy for dynamic method access
   */
  const api = new Proxy({} as WebviewContextValue['api'], {
    // eslint-disable-next-line code-complete/enforce-meaningful-names
    get: (_, key: string) => {
      return (...args: any[]) => {
        // Type assertion is safe here because the proxy ensures correct typing at usage
        return callApi(key, ...(args as Parameters<ClientCalls[keyof ClientCalls]>));
      };
    },
  });

  /**
   * Add an event listener with type safety
   */
  const addListener = <E extends keyof HostCalls>(key: E, callback: HostCalls[E]): void => {
    if (!listeners.current.has(key)) {
      listeners.current.set(key, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    listeners.current.get(key)!.add(callback as (...args: any[]) => void);
  };

  /**
   * Remove an event listener
   */
  const removeListener = <E extends keyof HostCalls>(key: E, callback: HostCalls[E]): void => {
    listeners.current.get(key)?.delete(callback as (...args: any[]) => void);
  };

  /**
   * Handle messages from the extension host
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = event.data;

      if (isViewApiResponse(message)) {
        const deferred = pendingRequests.current.get(message.id);
        if (deferred !== undefined) {
          deferred.clearTimeout(); // Clear timeout to prevent race condition
          pendingRequests.current.delete(message.id);
          deferred.resolve(message.value);
        }
      } else if (isViewApiError(message)) {
        // Handle API error
        const deferred = pendingRequests.current.get(message.id);
        if (deferred) {
          console.error('API error received for request %s:', message.id, message.value);
          deferred.clearTimeout(); // Clear timeout to prevent race condition
          pendingRequests.current.delete(message.id);
          deferred.reject(new Error(message.value));
        } else {
          console.warn(`No pending request found for error ID: ${message.id}`);
        }
      } else if (isViewApiEvent(message)) {
        // Handle event
        const callbacks = listeners.current.get(message.key);
        if (callbacks && callbacks.size > 0) {
          for (const callback of callbacks) {
            try {
              callback(...message.value);
            } catch (error) {
              console.error('Error in event listener for %s:', message.key, error);
            }
          }
        }
      } else if (message !== null && typeof message === 'object' && 'providerId' in message) {
        // No-op, handled by new IPC system
      } else {
        // Handle legacy messages that don't follow the new format
        // This ensures compatibility during migration
        console.error('Received legacy message format:', message);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  /**
   * Cleanup pending requests on unmount
   */
  useEffect(() => {
    const currentRequests = pendingRequests.current;
    return () => {
      // Clear timeouts and reject all pending requests
      for (const deferred of currentRequests.values()) {
        deferred.clearTimeout(); // Clear timeout to prevent late firing
        deferred.reject(new Error('WebviewProvider unmounted')); // Reject first while not settled
        deferred.markSettled(); // Then mark as settled to prevent subsequent resolve/reject calls
      }
      currentRequests.clear();
    };
  }, []);

  const contextValue: WebviewContextValue = {
    api,
    addListener,
    removeListener,
    isReady: true,
    vscode: vscodeApi,
  };

  return <WebviewContext.Provider value={contextValue}>{children}</WebviewContext.Provider>;
};
