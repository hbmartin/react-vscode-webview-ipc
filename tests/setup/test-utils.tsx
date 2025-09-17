import type { ReactElement } from 'react';
import type { RenderOptions } from '@testing-library/react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// Custom render function for React Testing Library
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, options);
}

// Mock WebviewApi for testing
export class MockWebviewApi {
  private state: any = {};
  public postMessage = vi.fn();

  getState() {
    return this.state;
  }

  setState(newState: any) {
    this.state = newState;
  }
}

// Create a mock message event
export function createMessageEvent(data: any): MessageEvent {
  return new MessageEvent('message', {
    data,
    origin: 'vscode-webview://test',
  });
}

// Helper to wait for async updates
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock VS Code extension context for host tests
export const mockExtensionContext = {
  subscriptions: [],
  workspaceState: {
    get: vi.fn(),
    update: vi.fn(),
    keys: vi.fn(() => []),
  },
  globalState: {
    get: vi.fn(),
    update: vi.fn(),
    keys: vi.fn(() => []),
    setKeysForSync: vi.fn(),
  },
  secrets: {
    get: vi.fn(),
    store: vi.fn(),
    delete: vi.fn(),
    onDidChange: vi.fn(),
  },
  extensionUri: { fsPath: '/test/extension' },
  extensionPath: '/test/extension',
  asAbsolutePath: vi.fn((path: string) => `/test/extension/${path}`),
  storagePath: '/test/storage',
  globalStoragePath: '/test/global-storage',
  logPath: '/test/logs',
  extensionMode: 3, // Production
  environmentVariableCollection: {
    persistent: true,
    description: 'test',
    replace: vi.fn(),
    append: vi.fn(),
    prepend: vi.fn(),
    get: vi.fn(),
    forEach: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    getScoped: vi.fn(),
  },
  storageUri: { fsPath: '/test/storage' },
  globalStorageUri: { fsPath: '/test/global-storage' },
  logUri: { fsPath: '/test/logs' },
  extension: {
    id: 'test.extension',
    extensionUri: { fsPath: '/test/extension' },
    extensionPath: '/test/extension',
    isActive: true,
    packageJSON: {},
    exports: undefined,
    activate: vi.fn(),
  },
  languageModelAccessInformation: {
    onDidChange: vi.fn(),
    canSendRequest: vi.fn(() => true),
  },
};

// Mock webview for host tests
export const mockWebview = {
  html: '',
  options: {},
  onDidReceiveMessage: vi.fn((callback: any) => {
    mockWebview._messageCallback = callback;
    return { dispose: vi.fn() };
  }),
  postMessage: vi.fn(),
  asWebviewUri: vi.fn((uri: any) => ({
    scheme: 'webview',
    authority: '',
    path: uri.path || '',
    query: '',
    fragment: '',
    fsPath: uri.fsPath || '',
    with: vi.fn(),
    toString: vi.fn(() => `webview-${uri.toString ? uri.toString() : uri}`),
    toJSON: vi.fn(),
  })),
  cspSource: 'test-csp',
  _messageCallback: null as any,
};

// Mock webview panel
export const mockWebviewPanel = {
  webview: mockWebview,
  title: 'Test Panel',
  iconPath: undefined,
  options: {},
  viewType: 'test.view',
  visible: true,
  active: true,
  viewColumn: 1,
  onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
  onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  reveal: vi.fn(),
  dispose: vi.fn(),
};

// Mock webview view
export const mockWebviewView = {
  webview: mockWebview,
  title: 'Test View',
  description: undefined,
  badge: undefined,
  viewType: 'test.view',
  show: vi.fn(),
  onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
  onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  visible: true,
};

// Helper to create test client/host call interfaces
export interface TestClientCalls {
  testMethod: (arg: string) => Promise<string>;
  asyncMethod: (n: number) => Promise<number>;
  errorMethod: () => Promise<never>;
}

export interface TestHostCalls {
  onUpdate: (data: any) => void;
  onError: (error: string) => void;
  onStateChange: (state: any) => void;
}

export * from '@testing-library/react';
