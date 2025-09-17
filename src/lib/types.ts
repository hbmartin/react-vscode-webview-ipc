export type Brand<T, B> = T & { readonly __brand: B };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HostCalls = Record<string, (...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientCalls = Record<string | symbol, (...args: any[]) => PromiseLike<any>>;

// eslint-disable-next-line code-complete/enforce-meaningful-names
declare const __t: unique symbol;
export interface CtxKey<T extends ClientCalls> {
  readonly id: symbol; // runtime identity
  /** phantom type: ties this key to T at compile time */
  readonly [__t]?: T;
}

/**
 * Request context information for tracking and debugging
 */
export interface RequestContext {
  viewId: string;
  viewType: string;
  timestamp: number;
  sessionId?: string;
}

/**
 * Internal message types for request/response communication
 */
export interface ViewApiRequest<T extends ClientCalls, K extends keyof T = keyof T> {
  type: 'request';
  id: string;
  key: K;
  params: Parameters<T[K]>;
  context?: RequestContext;
}

export interface ViewApiResponse<T extends ClientCalls, K extends keyof T = keyof T> {
  type: 'response';
  id: string;
  value?: Awaited<ReturnType<T[K]>>;
}

export interface ViewApiError {
  type: 'error';
  id: string;
  value: string;
}

export interface ViewApiEvent<T extends HostCalls, E extends keyof T = keyof T> {
  type: 'event';
  key: E;
  value: Parameters<T[E]>;
}

/**
 * Type guard to check if a message is a valid API request
 */
export function isViewApiRequest<T extends ClientCalls, K extends keyof T = keyof T>(
  message: unknown
): message is ViewApiRequest<T, K> {
  return (
    message !== null &&
    message !== undefined &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'request' &&
    'id' in message &&
    typeof message.id === 'string' &&
    'key' in message &&
    typeof message.key === 'string' &&
    'params' in message &&
    Array.isArray(message.params) &&
    (!('context' in message) ||
      message.context === undefined ||
      (typeof message.context === 'object' &&
        message.context !== null &&
        'viewId' in message.context &&
        'viewType' in message.context &&
        'timestamp' in message.context &&
        typeof message.context.viewId === 'string' &&
        typeof message.context.viewType === 'string' &&
        typeof message.context.timestamp === 'number'))
  );
}

/**
 * Type guard to check if a message is a valid API response
 */
export function isViewApiResponse<T extends ClientCalls, K extends keyof T = keyof T>(
  message: unknown
): message is ViewApiResponse<T, K> {
  return (
    message !== null &&
    message !== undefined &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'response' &&
    'id' in message &&
    typeof message.id === 'string'
  );
}

/**
 * Type guard to check if a message is a valid API error
 */
export function isViewApiError(message: unknown): message is ViewApiError {
  return (
    message !== null &&
    message !== undefined &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'error' &&
    'id' in message &&
    typeof message.id === 'string' &&
    'value' in message &&
    typeof message.value === 'string'
  );
}

/**
 * Type guard to check if a message is a valid API event
 */
export function isViewApiEvent<T extends HostCalls, E extends keyof T = keyof T>(
  message: unknown
): message is ViewApiEvent<T, E> {
  return (
    message !== null &&
    message !== undefined &&
    typeof message === 'object' &&
    'type' in message &&
    message.type === 'event' &&
    'key' in message &&
    typeof message.key === 'string' &&
    'value' in message &&
    Array.isArray(message.value)
  );
}

export type WebviewLayout = 'sidebar' | 'panel';

// VS Code webview API
export interface VsCodeApi {
  postMessage(message: unknown): Thenable<boolean>;
  getState(): unknown;
  setState(state: unknown): void;
}
