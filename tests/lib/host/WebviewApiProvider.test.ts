import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebviewApiProvider } from '../../../src/lib/host/WebviewApiProvider';
import type { HostCalls } from '../../../src/lib/types';
import { mockWebviewView } from '../../setup/test-utils';

// Test interface for host calls
interface TestHostCalls extends HostCalls {
  onDataUpdate: (data: any) => void;
  onUserAction: (action: string, payload?: any) => void;
  onError: (error: string) => void;
}

describe('WebviewApiProvider', () => {
  let provider: WebviewApiProvider<TestHostCalls>;

  beforeEach(() => {
    provider = new WebviewApiProvider<TestHostCalls>();
    vi.clearAllMocks();
    // Reset the mock webview
    mockWebviewView.webview.postMessage = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    provider.dispose();
  });

  describe('constructor', () => {
    it('should create provider with empty connected views', () => {
      expect(provider.getConnectedViewCount()).toBe(0);
    });
  });

  describe('registerView', () => {
    it('should register a webview successfully', () => {
      const viewId = 'test-view-1';

      provider.registerView(viewId, mockWebviewView);

      expect(provider.getConnectedViewCount()).toBe(1);
    });

    it('should not register the same view twice', () => {
      const viewId = 'test-view-1';

      provider.registerView(viewId, mockWebviewView);
      provider.registerView(viewId, mockWebviewView);

      expect(provider.getConnectedViewCount()).toBe(1);
    });

    it('should register multiple different views', () => {
      const view1 = { ...mockWebviewView, viewType: 'view1' };
      const view2 = { ...mockWebviewView, viewType: 'view2' };

      provider.registerView('view-1', view1);
      provider.registerView('view-2', view2);

      expect(provider.getConnectedViewCount()).toBe(2);
    });

    it('should handle view disposal', () => {
      const viewId = 'test-view-1';
      const disposableView = {
        ...mockWebviewView,
        onDidDispose: vi.fn((callback: () => void) => {
          // Simulate immediate disposal
          callback();
          return { dispose: vi.fn() };
        }),
      };

      provider.registerView(viewId, disposableView);

      // View should be automatically unregistered
      expect(provider.getConnectedViewCount()).toBe(0);
    });
  });

  describe('triggerEvent', () => {
    beforeEach(() => {
      provider.registerView('test-view', mockWebviewView);
    });

    it('should send event to registered view', () => {
      const testData = { message: 'test data' };

      provider.triggerEvent('onDataUpdate', testData);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [testData],
      });
    });

    it('should send event with multiple parameters', () => {
      const action = 'click';
      const payload = { x: 100, y: 200 };

      provider.triggerEvent('onUserAction', action, payload);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onUserAction',
        value: [action, payload],
      });
    });

    it('should send event with no parameters', () => {
      provider.triggerEvent('onError', 'Error message');

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onError',
        value: ['Error message'],
      });
    });

    it('should send events to multiple views', () => {
      const view2 = {
        ...mockWebviewView,
        viewType: 'view2',
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockResolvedValue(true),
        },
      };
      provider.registerView('test-view-2', view2);

      provider.triggerEvent('onDataUpdate', { data: 'test' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(1);
      expect(view2.webview.postMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle postMessage promise rejection', async () => {
      const failingView = {
        ...mockWebviewView,
        viewType: 'failingView',
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockRejectedValue(new Error('Message failed')),
        },
      };

      provider.registerView('failing-view', failingView);
      expect(provider.getConnectedViewCount()).toBe(2); // Both views registered

      provider.triggerEvent('onDataUpdate', { data: 'test' });

      // Verify that postMessage was called on the failing view
      expect(failingView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'test' }],
      });

      // The rejection is handled asynchronously but doesn't immediately remove the view
      // This is expected behavior - removal happens in the next event loop
      expect(provider.getConnectedViewCount()).toBe(2);
    });

    it('should handle synchronous postMessage exceptions', () => {
      const throwingView = {
        ...mockWebviewView,
        viewType: 'throwingView',
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockImplementation(() => {
            throw new Error('Synchronous error');
          }),
        },
      };

      provider.registerView('throwing-view', throwingView);

      expect(() => {
        provider.triggerEvent('onDataUpdate', { data: 'test' });
      }).not.toThrow();

      // Both views should initially be present, but the throwing view gets pruned
      expect(provider.getConnectedViewCount()).toBe(1); // Only the original view remains after pruning
    });

    it('should handle events with complex data structures', () => {
      const complexData = {
        user: { id: 123, name: 'John' },
        metadata: { timestamp: Date.now(), version: '1.0.0' },
        items: [1, 2, 3],
        nested: { deep: { value: 'test' } },
      };

      provider.triggerEvent('onDataUpdate', complexData);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [complexData],
      });
    });
  });

  describe('getConnectedViewCount', () => {
    it('should return 0 when no views are connected', () => {
      expect(provider.getConnectedViewCount()).toBe(0);
    });

    it('should return correct count when views are registered', () => {
      provider.registerView('view-1', mockWebviewView);
      expect(provider.getConnectedViewCount()).toBe(1);

      const view2 = { ...mockWebviewView, viewType: 'view2' };
      provider.registerView('view-2', view2);
      expect(provider.getConnectedViewCount()).toBe(2);
    });

    it('should handle multiple view registrations and event sending', () => {
      const view2 = {
        ...mockWebviewView,
        viewType: 'view2',
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockResolvedValue(true),
        },
      };

      provider.registerView('view-1', mockWebviewView);
      provider.registerView('view-2', view2);

      expect(provider.getConnectedViewCount()).toBe(2);

      provider.triggerEvent('onDataUpdate', { data: 'test' });

      // Both views should receive the event
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'test' }],
      });
      expect(view2.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'test' }],
      });
    });
  });

  describe('dispose', () => {
    it('should clear all connected views', () => {
      provider.registerView('view-1', mockWebviewView);
      const view2 = { ...mockWebviewView, viewType: 'view2' };
      provider.registerView('view-2', view2);

      expect(provider.getConnectedViewCount()).toBe(2);

      provider.dispose();

      expect(provider.getConnectedViewCount()).toBe(0);
    });

    it('should not throw when called multiple times', () => {
      provider.dispose();
      expect(() => provider.dispose()).not.toThrow();
    });

    it('should prevent further operations after disposal', () => {
      provider.registerView('view-1', mockWebviewView);
      provider.dispose();

      // Should not crash when trying to trigger events on disposed provider
      expect(() => {
        provider.triggerEvent('onDataUpdate', { data: 'test' });
      }).not.toThrow();

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle null/undefined data in events', () => {
      // Reset for fresh state
      mockWebviewView.webview.postMessage = vi.fn().mockResolvedValue(true);
      provider.registerView('test-view', mockWebviewView);

      provider.triggerEvent('onDataUpdate', null);
      provider.triggerEvent('onDataUpdate', undefined);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWebviewView.webview.postMessage).toHaveBeenNthCalledWith(1, {
        type: 'event',
        key: 'onDataUpdate',
        value: [null],
      });
      expect(mockWebviewView.webview.postMessage).toHaveBeenNthCalledWith(2, {
        type: 'event',
        key: 'onDataUpdate',
        value: [undefined],
      });
    });

    it('should handle empty parameter lists', () => {
      provider.registerView('test-view', mockWebviewView);

      // Cast to bypass TypeScript checking for testing purposes
      (provider as any).triggerEvent('onDataUpdate');

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [],
      });
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid event triggering', () => {
      // Reset for fresh state
      mockWebviewView.webview.postMessage = vi.fn().mockResolvedValue(true);
      provider.registerView('test-view', mockWebviewView);

      const events = 10;
      for (let i = 0; i < events; i++) {
        provider.triggerEvent('onDataUpdate', { index: i });
      }

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(events);
    });

    it('should handle concurrent view registration and event triggering', () => {
      const views = 5;

      // Register multiple views concurrently
      for (let i = 0; i < views; i++) {
        const view = { ...mockWebviewView, viewType: `view${i}` };
        provider.registerView(`view-${i}`, view);
      }

      expect(provider.getConnectedViewCount()).toBe(views);

      // Trigger event to all views
      provider.triggerEvent('onDataUpdate', { data: 'broadcast' });

      // Each view should receive the event
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(views);
    });
  });
});
