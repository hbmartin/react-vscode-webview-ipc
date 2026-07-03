import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebviewApiProvider } from '../../../src/lib/host/WebviewApiProvider';
import type { HostCalls } from '../../../src/lib/types';
import type { WebviewKey } from '../../../src/lib/types/reducer';
import { mockWebviewView } from '../../setup/test-utils';

// Helper to create WebviewKey
function createWebviewKey(id: string): WebviewKey {
  return id as WebviewKey;
}

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
      const viewId = createWebviewKey('test-view-1');

      provider.registerView(viewId, mockWebviewView);

      expect(provider.getConnectedViewCount()).toBe(1);
    });

    it('should not register the same view twice', () => {
      const viewId = createWebviewKey('test-view-1');

      provider.registerView(viewId, mockWebviewView);
      provider.registerView(viewId, mockWebviewView);

      expect(provider.getConnectedViewCount()).toBe(1);
    });

    it('should register multiple different views', () => {
      const view1 = { ...mockWebviewView, viewType: 'view1' };
      const view2 = { ...mockWebviewView, viewType: 'view2' };

      provider.registerView(createWebviewKey('view-1'), view1);
      provider.registerView(createWebviewKey('view-2'), view2);

      expect(provider.getConnectedViewCount()).toBe(2);
    });

    it('should handle view disposal', () => {
      const viewId = createWebviewKey('test-view-1');
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

    it('should not let an old dispose callback unregister a replacement view', () => {
      const viewId = createWebviewKey('test-view-1');
      let disposeOldView: (() => void) | undefined;
      const oldView = {
        ...mockWebviewView,
        viewType: 'oldView',
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockResolvedValue(true),
        },
        onDidDispose: vi.fn((callback: () => void) => {
          disposeOldView = callback;
          return { dispose: vi.fn() };
        }),
      };
      const newView = {
        ...mockWebviewView,
        viewType: 'newView',
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockResolvedValue(true),
        },
      };

      provider.registerView(viewId, oldView);
      provider.registerView(viewId, newView);
      disposeOldView?.();

      expect(provider.getConnectedViewCount()).toBe(1);

      provider.triggerEvent('onDataUpdate', { data: 'test' });

      expect(newView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'test' }],
      });
    });

    it('should dispose visibility listeners when the provider is disposed', () => {
      const visibilityDisposable = { dispose: vi.fn() };
      const disposableView = {
        ...mockWebviewView,
        onDidChangeVisibility: vi.fn(() => visibilityDisposable),
        onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      };

      provider.registerView(createWebviewKey('test-view-1'), disposableView);
      provider.dispose();

      expect(visibilityDisposable.dispose).toHaveBeenCalled();
    });
  });

  describe('triggerEvent', () => {
    beforeEach(() => {
      provider.registerView(createWebviewKey('test-view'), mockWebviewView);
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
      provider.registerView(createWebviewKey('test-view-2'), view2);

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

      provider.registerView(createWebviewKey('failing-view'), failingView);
      expect(provider.getConnectedViewCount()).toBe(2); // Both views registered

      provider.triggerEvent('onDataUpdate', { data: 'test' });
      await Promise.resolve();

      // Verify that postMessage was called on the failing view
      expect(failingView.webview.postMessage).toHaveBeenCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'test' }],
      });

      expect(provider.getConnectedViewCount()).toBe(1);
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

      provider.registerView(createWebviewKey('throwing-view'), throwingView);

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

  describe('hidden view event queueing', () => {
    function createHiddenView() {
      let visibilityCallback: (() => void) | undefined;
      const view: any = {
        ...mockWebviewView,
        viewType: 'hiddenView',
        visible: false,
        webview: {
          ...mockWebviewView.webview,
          postMessage: vi.fn().mockResolvedValue(true),
        },
        onDidChangeVisibility: vi.fn((callback: () => void) => {
          visibilityCallback = callback;
          return { dispose: vi.fn() };
        }),
        onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      };
      return {
        view,
        show: () => {
          view.visible = true;
          visibilityCallback?.();
        },
      };
    }

    it('should queue events for hidden views instead of posting', () => {
      const { view } = createHiddenView();
      provider.registerView(createWebviewKey('hidden-view'), view);

      provider.triggerEvent('onDataUpdate', { data: 'while hidden' });

      expect(view.webview.postMessage).not.toHaveBeenCalled();
      expect(provider.getConnectedViewCount()).toBe(1);
    });

    it('should flush queued events in order when the view becomes visible', () => {
      const { view, show } = createHiddenView();
      provider.registerView(createWebviewKey('hidden-view'), view);

      provider.triggerEvent('onDataUpdate', { data: 'first' });
      provider.triggerEvent('onUserAction', 'click', { x: 1 });

      show();

      expect(view.webview.postMessage).toHaveBeenCalledTimes(2);
      expect(view.webview.postMessage).toHaveBeenNthCalledWith(1, {
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'first' }],
      });
      expect(view.webview.postMessage).toHaveBeenNthCalledWith(2, {
        type: 'event',
        key: 'onUserAction',
        value: ['click', { x: 1 }],
      });
    });

    it('should drop the oldest event when the per-view queue is full', () => {
      const boundedProvider = new WebviewApiProvider<TestHostCalls>({ maxQueuedEvents: 2 });
      const { view, show } = createHiddenView();
      boundedProvider.registerView(createWebviewKey('hidden-view'), view);

      boundedProvider.triggerEvent('onDataUpdate', { data: 'one' });
      boundedProvider.triggerEvent('onDataUpdate', { data: 'two' });
      boundedProvider.triggerEvent('onDataUpdate', { data: 'three' });

      show();

      expect(view.webview.postMessage).toHaveBeenCalledTimes(2);
      const values = view.webview.postMessage.mock.calls.map((call: any[]) => call[0].value);
      expect(values).toEqual([[{ data: 'two' }], [{ data: 'three' }]]);
      boundedProvider.dispose();
    });

    it('should drop hidden events when maxQueuedEvents is zero', () => {
      const zeroQueueProvider = new WebviewApiProvider<TestHostCalls>({ maxQueuedEvents: 0 });
      const { view, show } = createHiddenView();
      zeroQueueProvider.registerView(createWebviewKey('hidden-view'), view);

      zeroQueueProvider.triggerEvent('onDataUpdate', { data: 'dropped' });
      show();

      expect(view.webview.postMessage).not.toHaveBeenCalled();
      zeroQueueProvider.dispose();
    });

    it('should requeue queued events when flush resolves false', async () => {
      const { view, show } = createHiddenView();
      view.webview.postMessage = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      provider.registerView(createWebviewKey('hidden-view'), view);

      provider.triggerEvent('onDataUpdate', { data: 'retry' });
      show();
      await Promise.resolve();

      expect(view.webview.postMessage).toHaveBeenCalledTimes(1);

      show();
      await Promise.resolve();

      expect(view.webview.postMessage).toHaveBeenCalledTimes(2);
      expect(view.webview.postMessage).toHaveBeenLastCalledWith({
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'retry' }],
      });
    });

    it('should prune a hidden view when queued event flush rejects', async () => {
      const { view, show } = createHiddenView();
      view.webview.postMessage = vi.fn().mockRejectedValue(new Error('flush failed'));
      provider.registerView(createWebviewKey('hidden-view'), view);

      provider.triggerEvent('onDataUpdate', { data: 'test' });
      show();
      await Promise.resolve();

      expect(provider.getConnectedViewCount()).toBe(0);
    });

    it('should prune a hidden view when queued event flush throws', () => {
      const { view, show } = createHiddenView();
      view.webview.postMessage = vi.fn(() => {
        throw new Error('flush threw');
      });
      provider.registerView(createWebviewKey('hidden-view'), view);

      provider.triggerEvent('onDataUpdate', { data: 'test' });
      show();

      expect(provider.getConnectedViewCount()).toBe(0);
    });

    it('should post directly to hidden views when queueing is disabled', () => {
      const nonQueueingProvider = new WebviewApiProvider<TestHostCalls>({
        queueHiddenEvents: false,
      });
      const { view } = createHiddenView();
      nonQueueingProvider.registerView(createWebviewKey('hidden-view'), view);

      nonQueueingProvider.triggerEvent('onDataUpdate', { data: 'test' });

      expect(view.webview.postMessage).toHaveBeenCalledTimes(1);
      nonQueueingProvider.dispose();
    });

    it('should still post immediately to visible views', () => {
      provider.registerView(createWebviewKey('visible-view'), mockWebviewView);

      provider.triggerEvent('onDataUpdate', { data: 'test' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConnectedViewCount', () => {
    it('should return 0 when no views are connected', () => {
      expect(provider.getConnectedViewCount()).toBe(0);
    });

    it('should return correct count when views are registered', () => {
      provider.registerView(createWebviewKey('view-1'), mockWebviewView);
      expect(provider.getConnectedViewCount()).toBe(1);

      const view2 = { ...mockWebviewView, viewType: 'view2' };
      provider.registerView(createWebviewKey('view-2'), view2);
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

      provider.registerView(createWebviewKey('view-1'), mockWebviewView);
      provider.registerView(createWebviewKey('view-2'), view2);

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
      provider.registerView(createWebviewKey('view-1'), mockWebviewView);
      const view2 = { ...mockWebviewView, viewType: 'view2' };
      provider.registerView(createWebviewKey('view-2'), view2);

      expect(provider.getConnectedViewCount()).toBe(2);

      provider.dispose();

      expect(provider.getConnectedViewCount()).toBe(0);
    });

    it('should not throw when called multiple times', () => {
      provider.dispose();
      expect(() => provider.dispose()).not.toThrow();
    });

    it('should prevent further operations after disposal', () => {
      provider.registerView(createWebviewKey('view-1'), mockWebviewView);
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
      provider.registerView(createWebviewKey('test-view'), mockWebviewView);

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
      provider.registerView(createWebviewKey('test-view'), mockWebviewView);

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
      provider.registerView(createWebviewKey('test-view'), mockWebviewView);

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
        provider.registerView(createWebviewKey(`view-${i}`), view);
      }

      expect(provider.getConnectedViewCount()).toBe(views);

      // Trigger event to all views
      provider.triggerEvent('onDataUpdate', { data: 'broadcast' });

      // Each view should receive the event
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledTimes(views);
    });
  });
});
