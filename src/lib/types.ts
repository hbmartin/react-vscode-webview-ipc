export type Brand<T, B> = T & { readonly __brand: B };

export type HostCalls = Record<string, (...args: unknown[]) => unknown>;
export type ClientCalls = Record<string, (...args: unknown[]) => Promise<unknown>>;

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
export interface ViewApiRequest<K extends keyof ClientCalls = keyof ClientCalls> {
  type: 'request';
  id: string;
  key: K;
  params: Parameters<ClientCalls[K]>;
  context?: RequestContext;
}

export interface ViewApiResponse<K extends keyof ClientCalls = keyof ClientCalls> {
  type: 'response';
  id: string;
  value?: Awaited<ReturnType<ClientCalls[K]>>;
}

export interface ViewApiError {
  type: 'error';
  id: string;
  value: string;
}

export interface ViewApiEvent<E extends keyof HostCalls = keyof HostCalls> {
  type: 'event';
  key: E;
  value: Parameters<HostCalls[E]>;
}

export type ViewApiMessage = ViewApiRequest | ViewApiResponse | ViewApiError | ViewApiEvent;

/**
 * Type guard to check if a message is a valid API request
 */
export function isViewApiRequest(message: unknown): message is ViewApiRequest {
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
    'context' in message &&
    (message.context === undefined ||
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
export function isViewApiResponse(message: unknown): message is ViewApiResponse {
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
export function isViewApiEvent(message: unknown): message is ViewApiEvent {
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

export interface WebviewContextData {
  layout: WebviewLayout;
  extensionUri: string;
  logoUris?: {
    cursor: string;
    windsurf: string;
    claudeCode: string;
    lovable: string;
    bolt: string;
  };
}

// VS Code webview API
export interface VsCodeApi {
  postMessage(message: unknown): Thenable<boolean>;
  getState(): unknown;
  setState(state: unknown): void;
}
