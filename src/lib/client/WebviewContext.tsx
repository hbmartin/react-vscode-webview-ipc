import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  isViewApiResponse,
  isViewApiError,
  isViewApiEvent,
  type ClientCalls,
  type HostCalls,
  type ViewApiRequest,
  type RequestContext,
  type VsCodeApi,
  acquireVsCodeApi,
} from '../types';

/**
 * Deferred promise for handling async responses with timeout management
 */
class DeferredPromise<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason?: any) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  private settled = false;

  constructor(readonly key: string) {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = (value: T) => {
        if (!this.settled) {
          this.settled = true;
          resolve(value);
        }
      };
      this.reject = (reason?: any) => {
        if (!this.settled) {
          this.settled = true;
          reject(reason instanceof Error ? reason : new Error(String(reason)));
        }
      };
    });
  }

  /**
   * Clear the timeout handle if it exists
   */
  clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  /**
   * Mark this deferred as settled to prevent further resolve/reject calls
   */
  markSettled(): void {
    this.settled = true;
  }
}

/**
 * Generate a unique ID for requests
 */
function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Context value interface providing type-safe API access
 */
interface WebviewContextValue {
  api: {
    [K in keyof ClientCalls]: (...args: Parameters<ClientCalls[K]>) => ReturnType<ClientCalls[K]>;
  };
  addListener: <E extends keyof HostCalls>(key: E, callback: HostCalls[E]) => void;
  removeListener: <E extends keyof HostCalls>(key: E, callback: HostCalls[E]) => void;
  isReady: boolean;
  vscode: VsCodeApi;
}

export const WebviewContext = createContext<WebviewContextValue | null>(null);

/**
 * Hook to access the webview API
 */
export const useWebviewApi = (): WebviewContextValue => {
  const context = useContext(WebviewContext);
  if (!context) {
    throw new Error('useWebviewApi must be used within WebviewProvider');
  }
  return context;
};

interface WebviewProviderProps {
  viewType: string;
  children: React.ReactNode;
}

const vscodeApi = acquireVsCodeApi();

/**
 * WebviewProvider provides type-safe API access to webview components
 */
export const WebviewProvider: React.FC<WebviewProviderProps> = ({ children, viewType }) => {
  const pendingRequests = useRef<Map<string, DeferredPromise<any>>>(new Map());
  const listeners = useRef<Map<keyof HostCalls, Set<(...args: any[]) => void>>>(new Map());

  // Generate context for this webview instance
  const contextRef = useRef<RequestContext>({
    viewId: `webview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    viewType: viewType,
    timestamp: Date.now(),
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  });

  /**
   * Type-safe API caller with request/response matching
   */
  const callApi = <K extends keyof ClientCalls>(
    key: K,
    ...params: Parameters<ClientCalls[K]>
  ): ReturnType<ClientCalls[K]> => {
    const id = generateId();
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
    try {
      vscodeApi.postMessage(request);
    } catch (error) {
      console.error(`Failed to send API request ${key}:`, error);
      deferred.clearTimeout();
      pendingRequests.current.delete(id);
      deferred.reject(error instanceof Error ? error : new Error(String(error)));
    }

    return deferred.promise as ReturnType<ClientCalls[K]>;
  };

  /**
   * Create typed API object using Proxy for dynamic method access
   */
  const api = new Proxy({} as WebviewContextValue['api'], {
    get: (_, key: string) => {
      return (...args: any[]) => {
        // Type assertion is safe here because the proxy ensures correct typing at usage
        return callApi(
          key as keyof ClientCalls,
          ...(args as Parameters<ClientCalls[keyof ClientCalls]>)
        );
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
    const handleMessage = (event: MessageEvent<any>) => {
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
          callbacks.forEach((cb) => {
            try {
              cb(...message.value);
            } catch (error) {
              console.error('Error in event listener for %s:', message.key, error);
            }
          });
        }
      } else if (message && typeof message === 'object' && 'providerId' in message) {
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
      currentRequests.forEach((deferred) => {
        deferred.clearTimeout(); // Clear timeout to prevent late firing
        deferred.reject(new Error('WebviewProvider unmounted')); // Reject first while not settled
        deferred.markSettled(); // Then mark as settled to prevent subsequent resolve/reject calls
      });
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

/**
 * Higher-order component to ensure WebviewProvider is available
 */
export function withWebviewApi<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <WebviewProvider viewType={Component.name}>
        <Component {...props} />
      </WebviewProvider>
    );
  };

  WrappedComponent.displayName = `withWebviewApi(${Component.displayName ?? Component.name})`;

  return WrappedComponent;
}
