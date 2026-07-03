import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseWebviewViewProvider } from '../../../src/lib/host/BaseWebviewViewProvider';
import {
  type ActionDelegate,
  type WebviewKey,
  ACT_ERROR,
  PATCH,
} from '../../../src/lib/types/reducer';
import { LogLevel } from '../../../src/lib/types';
import type { WebviewApiProvider } from '../../../src/lib/host/WebviewApiProvider';
import type * as vscode from 'vscode';

// Test actions interface
interface TestActions {
  fetchData: (id: string) => Promise<{ data: string }>;
  updateSettings: (settings: any) => void;
}

// Concrete implementation for testing
class TestWebviewProvider extends BaseWebviewViewProvider<TestActions> {
  protected webviewActionDelegate: ActionDelegate<TestActions> = {
    fetchData: vi.fn(async (id: string) => ({ data: `Data for ${id}` })),
    updateSettings: vi.fn((_settings: any) => undefined),
  };

  public generateWebviewHtml = vi.fn(
    (_webview: vscode.Webview, _extensionUri: vscode.Uri): string => {
      return '<html><body>Test</body></html>';
    }
  );

  public handleMessage = vi.fn(
    async (_message: unknown, _webview: vscode.Webview): Promise<void> => {
      // Test implementation
    }
  );

  // Expose protected methods for testing
  public testHandleLogMessage(message: any) {
    this.handleLogMessage(message);
  }

  public testOnWebviewDispose() {
    this.onWebviewDispose();
  }

  public get view() {
    return this._view;
  }
}

describe('BaseWebviewViewProvider', () => {
  let provider: TestWebviewProvider;
  let mockWebviewView: any;
  let mockWebview: any;
  let mockExtensionUri: any;
  let mockApiProvider: WebviewApiProvider<any>;
  let messageCallback: (message: any) => void;
  let disposeCallback: () => void;
  let visibilityCallback: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock webview
    mockWebview = {
      html: '',
      options: {},
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((callback: any) => {
        messageCallback = callback;
        return { dispose: vi.fn() };
      }),
      asWebviewUri: vi.fn((uri: any) => uri),
    };

    // Setup mock webview view
    mockWebviewView = {
      webview: mockWebview,
      title: 'Test View',
      description: undefined,
      badge: undefined,
      show: vi.fn(),
      onDidChangeVisibility: vi.fn((callback: () => void) => {
        visibilityCallback = callback;
        return { dispose: vi.fn() };
      }),
      onDidDispose: vi.fn((callback: () => void) => {
        disposeCallback = callback;
        return { dispose: vi.fn() };
      }),
      visible: true,
    };

    // Setup mock extension URI
    mockExtensionUri = {
      scheme: 'file',
      authority: '',
      path: '/test/extension',
      query: '',
      fragment: '',
      fsPath: '/test/extension',
      with: vi.fn(),
      toString: vi.fn(() => 'file:///test/extension'),
      toJSON: vi.fn(),
    };

    // Setup mock API provider
    mockApiProvider = {
      registerView: vi.fn(),
    } as any;

    // vscode.Uri.joinPath is already mocked above

    provider = new TestWebviewProvider(
      'test.provider' as WebviewKey,
      mockExtensionUri,
      mockApiProvider
    );
  });

  describe('constructor', () => {
    it('should initialize with provider ID and extension URI', () => {
      const provider = new TestWebviewProvider('test.provider' as WebviewKey, mockExtensionUri);
      expect(provider).toBeDefined();
    });

    it('should initialize with API provider', () => {
      const provider = new TestWebviewProvider(
        'test.provider' as WebviewKey,
        mockExtensionUri,
        mockApiProvider
      );
      expect(provider).toBeDefined();
    });
  });

  describe('resolveWebviewView', () => {
    it('should setup webview options', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockWebviewView.webview.options).toEqual({
        enableScripts: true,
        localResourceRoots: expect.any(Array),
      });
    });

    it('should set webview HTML', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(provider.generateWebviewHtml).toHaveBeenCalledWith(mockWebview, mockExtensionUri);
      expect(mockWebview.html).toBe('<html><body>Test</body></html>');
    });

    it('should register view with API provider', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockApiProvider.registerView).toHaveBeenCalledWith('test.provider', mockWebviewView);
    });

    it('should setup message listener', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should setup dispose listener', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockWebviewView.onDidDispose).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    beforeEach(() => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should handle log messages', async () => {
      const logMessage = {
        type: 'log',
        level: LogLevel.INFO,
        message: 'Test log',
        data: { key: 'value' },
      };

      const loggerSpy = vi.spyOn(provider['logger'], 'info');
      await messageCallback(logMessage);

      expect(loggerSpy).toHaveBeenCalledWith('Test log', { key: 'value' });
    });

    it('should handle action messages', async () => {
      const actionMessage = {
        type: 'act',
        providerId: 'test.provider',
        key: 'fetchData',
        params: ['123'],
      };

      await messageCallback(actionMessage);

      expect(provider['webviewActionDelegate'].fetchData).toHaveBeenCalledWith('123');
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: PATCH,
        providerId: 'test.provider',
        key: 'fetchData',
        patch: { data: 'Data for 123' },
      });
    });

    it('should not throw for unknown action key and post an actError message', async () => {
      const actionMessage = {
        type: 'act',
        providerId: 'test.provider',
        key: 'unknownMethod',
        params: [],
      };

      const loggerSpy = vi.spyOn(provider['logger'], 'error');
      await expect(messageCallback(actionMessage)).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown action key: unknownMethod')
      );
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: ACT_ERROR,
        providerId: 'test.provider',
        key: 'unknownMethod',
        error: 'Unknown action key: unknownMethod',
      });
    });

    it('should handle rejecting action delegates without unhandled rejection', async () => {
      const failure = new Error('delegate blew up');
      (provider['webviewActionDelegate'].fetchData as any).mockRejectedValueOnce(failure);

      const loggerSpy = vi.spyOn(provider['logger'], 'error');
      const actionMessage = {
        type: 'act',
        providerId: 'test.provider',
        key: 'fetchData',
        params: ['123'],
      };

      await expect(messageCallback(actionMessage)).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Action 'fetchData' failed: delegate blew up")
      );
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: ACT_ERROR,
        providerId: 'test.provider',
        key: 'fetchData',
        error: 'delegate blew up',
      });
    });

    it('should invoke onActionError hook when a delegate fails', async () => {
      const failure = new Error('nope');
      (provider['webviewActionDelegate'].fetchData as any).mockRejectedValueOnce(failure);
      const hookSpy = vi.spyOn(provider as any, 'onActionError');

      await messageCallback({
        type: 'act',
        providerId: 'test.provider',
        key: 'fetchData',
        params: ['123'],
      });

      expect(hookSpy).toHaveBeenCalledWith('fetchData', failure);
    });

    it('should not propagate rejections from handleMessage', async () => {
      provider.handleMessage.mockRejectedValueOnce(new Error('consumer handler failed'));
      const loggerSpy = vi.spyOn(provider['logger'], 'error');

      await expect(messageCallback({ type: 'custom' })).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('consumer handler failed'));
    });

    it('should call handleMessage for other messages', async () => {
      const otherMessage = { type: 'custom', data: 'test' };

      await messageCallback(otherMessage);

      expect(provider.handleMessage).toHaveBeenCalledWith(otherMessage, mockWebview);
    });
  });

  describe('postPatch', () => {
    beforeEach(() => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should post patch message to webview', () => {
      provider.postPatch('fetchData', { data: 'Updated data' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: PATCH,
        providerId: 'test.provider',
        key: 'fetchData',
        patch: { data: 'Updated data' },
      });
    });

    it('should not throw if view is not initialized', () => {
      const newProvider = new TestWebviewProvider('test.provider' as WebviewKey, mockExtensionUri);

      expect(() => {
        newProvider.postPatch('fetchData', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('hidden webview message queueing', () => {
    it('should queue patches while the view is hidden and flush when visible again', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      mockWebviewView.visible = false;
      provider.postPatch('fetchData', { data: 'while hidden' });

      expect(mockWebview.postMessage).not.toHaveBeenCalled();

      mockWebviewView.visible = true;
      visibilityCallback();

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: PATCH,
        providerId: 'test.provider',
        key: 'fetchData',
        patch: { data: 'while hidden' },
      });
    });

    it('should queue patches posted before the view is resolved and flush on resolve', () => {
      provider.postPatch('fetchData', { data: 'before resolve' });
      expect(mockWebview.postMessage).not.toHaveBeenCalled();

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        type: PATCH,
        providerId: 'test.provider',
        key: 'fetchData',
        patch: { data: 'before resolve' },
      });
    });

    it('should preserve message order when flushing', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      mockWebviewView.visible = false;
      provider.postPatch('fetchData', { data: 'first' });
      provider.postPatch('fetchData', { data: 'second' });

      mockWebviewView.visible = true;
      visibilityCallback();

      const patches = mockWebview.postMessage.mock.calls.map((call: any[]) => call[0].patch);
      expect(patches).toEqual([{ data: 'first' }, { data: 'second' }]);
    });

    it('should drop the oldest message when the queue is full', () => {
      const boundedProvider = new TestWebviewProvider(
        'test.provider' as WebviewKey,
        mockExtensionUri,
        mockApiProvider,
        { maxQueuedMessages: 2 }
      );
      boundedProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      mockWebviewView.visible = false;
      boundedProvider.postPatch('fetchData', { data: 'one' });
      boundedProvider.postPatch('fetchData', { data: 'two' });
      boundedProvider.postPatch('fetchData', { data: 'three' });

      mockWebviewView.visible = true;
      visibilityCallback();

      const patches = mockWebview.postMessage.mock.calls.map((call: any[]) => call[0].patch);
      expect(patches).toEqual([{ data: 'two' }, { data: 'three' }]);
    });

    it('should drop messages while hidden when queueing is disabled', () => {
      const nonQueueingProvider = new TestWebviewProvider(
        'test.provider' as WebviewKey,
        mockExtensionUri,
        mockApiProvider,
        { queueHiddenMessages: false }
      );
      nonQueueingProvider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      mockWebviewView.visible = false;
      nonQueueingProvider.postPatch('fetchData', { data: 'dropped' });

      mockWebviewView.visible = true;
      visibilityCallback();

      expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });

    it('should stop posting to a disposed view and queue instead', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      disposeCallback();

      expect(() => {
        provider.postPatch('fetchData', { data: 'after dispose' });
      }).not.toThrow();
      expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleLogMessage', () => {
    it('should handle DEBUG level', () => {
      const debugSpy = vi.spyOn(provider['logger'], 'debug');
      provider.testHandleLogMessage({
        level: LogLevel.DEBUG,
        message: 'Debug message',
        data: { test: true },
      });

      expect(debugSpy).toHaveBeenCalledWith('Debug message', { test: true });
    });

    it('should handle INFO level', () => {
      const infoSpy = vi.spyOn(provider['logger'], 'info');
      provider.testHandleLogMessage({
        level: LogLevel.INFO,
        message: 'Info message',
        data: { test: true },
      });

      expect(infoSpy).toHaveBeenCalledWith('Info message', { test: true });
    });

    it('should handle WARN level', () => {
      const warnSpy = vi.spyOn(provider['logger'], 'warn');
      provider.testHandleLogMessage({
        level: LogLevel.WARN,
        message: 'Warn message',
        data: { test: true },
      });

      expect(warnSpy).toHaveBeenCalledWith('Warn message', { test: true });
    });

    it('should handle ERROR level', () => {
      const errorSpy = vi.spyOn(provider['logger'], 'error');
      provider.testHandleLogMessage({
        level: LogLevel.ERROR,
        message: 'Error message',
        data: { test: true },
      });

      expect(errorSpy).toHaveBeenCalledWith('Error message', { test: true });
    });
  });

  describe('onWebviewDispose', () => {
    it('should be called when webview is disposed', () => {
      // Spy on the protected method through the public wrapper
      const disposeSpy = vi.spyOn(provider as any, 'onWebviewDispose');

      // Set up the webview view after creating the spy
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Trigger dispose callback
      disposeCallback();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should have default implementation that does nothing', () => {
      expect(() => {
        provider.testOnWebviewDispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle provider ID without dot', () => {
      const provider = new TestWebviewProvider('simpleProvider' as WebviewKey, mockExtensionUri);
      expect(provider).toBeDefined();
    });

    it('should handle async action delegates', async () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const actionMessage = {
        type: 'act',
        providerId: 'test.provider',
        key: 'fetchData',
        params: ['async-test'],
      };

      await messageCallback(actionMessage);

      expect(provider['webviewActionDelegate'].fetchData).toHaveBeenCalledWith('async-test');
    });

    it('should handle sync action delegates', async () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const actionMessage = {
        type: 'act',
        providerId: 'test.provider',
        key: 'updateSettings',
        params: [{ theme: 'dark' }],
      };

      await messageCallback(actionMessage);

      expect(provider['webviewActionDelegate'].updateSettings).toHaveBeenCalledWith({
        theme: 'dark',
      });
    });
  });
});
