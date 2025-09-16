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
export function isViewApiRequest(msg: any): msg is ViewApiRequest {
  return (
    msg &&
    typeof msg === 'object' &&
    msg.type === 'request' &&
    typeof msg.id === 'string' &&
    typeof msg.key === 'string' &&
    Array.isArray(msg.params) &&
    (msg.context === undefined ||
      (typeof msg.context === 'object' &&
        typeof msg.context.viewId === 'string' &&
        typeof msg.context.viewType === 'string' &&
        typeof msg.context.timestamp === 'number'))
  );
}

/**
 * Type guard to check if a message is a valid API response
 */
export function isViewApiResponse(msg: any): msg is ViewApiResponse {
  return (
    msg !== null &&
    msg !== undefined &&
    typeof msg === 'object' &&
    msg.type === 'response' &&
    typeof msg.id === 'string'
  );
}

/**
 * Type guard to check if a message is a valid API error
 */
export function isViewApiError(msg: any): msg is ViewApiError {
  return (
    msg &&
    typeof msg === 'object' &&
    msg.type === 'error' &&
    typeof msg.id === 'string' &&
    typeof msg.value === 'string'
  );
}

/**
 * Type guard to check if a message is a valid API event
 */
export function isViewApiEvent(msg: any): msg is ViewApiEvent {
  return (
    msg &&
    typeof msg === 'object' &&
    msg.type === 'event' &&
    typeof msg.key === 'string' &&
    Array.isArray(msg.value)
  );
}

export type WebviewLayout = 'sidebar' | 'panel';

export interface WebviewContext {
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
  postMessage(message: any): Thenable<boolean>;
  getState(): any;
  setState(state: any): void;
}

export declare function acquireVsCodeApi(): VsCodeApi;
