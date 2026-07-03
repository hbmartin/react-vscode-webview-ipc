import type { HostCalls, RequestContext, ViewApiEvent } from '../types';
import { generateId, getErrorMessage } from '../utils';
import { getLogger } from './logger';
import type { WebviewKey } from '../types/reducer';
import type * as vscode from 'vscode';

/**
 * WebviewApiProvider implements the type-safe API contract between host and webviews.
 * It handles all API calls and event dispatching with full type safety.
 */
interface ConnectedView<T extends HostCalls> {
  view: vscode.WebviewView;
  context: RequestContext;
  pendingEvents: ViewApiEvent<T>[];
}

export interface WebviewApiProviderOptions {
  /**
   * When true (the default), events triggered while a webview is hidden are
   * queued per view and flushed when the view becomes visible, instead of
   * being silently dropped by VS Code.
   */
  queueHiddenEvents?: boolean;
  /** Maximum number of queued events kept per hidden view. Defaults to 100. */
  maxQueuedEvents?: number;
}

// eslint-disable-next-line code-complete/no-magic-numbers-except-zero-one
const DEFAULT_MAX_QUEUED_EVENTS = 100;

export class WebviewApiProvider<T extends HostCalls> implements vscode.Disposable {
  private readonly connectedViews = new Map<WebviewKey, ConnectedView<T>>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly logger = getLogger('WebviewApiProvider');
  private readonly queueHiddenEvents: boolean;
  private readonly maxQueuedEvents: number;

  constructor(options?: WebviewApiProviderOptions) {
    this.queueHiddenEvents = options?.queueHiddenEvents ?? true;
    this.maxQueuedEvents = options?.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS;
  }

  /**
   * Type-safe event triggering to all connected webviews
   * Events for hidden views are queued (see WebviewApiProviderOptions)
   * Prunes failing webviews to prevent unbounded growth and repeated failures
   */
  triggerEvent<E extends keyof T>(key: E, ...params: Parameters<T[E]>): void {
    const event: ViewApiEvent<T> = {
      type: 'event',
      key,
      value: params,
    };

    // Send to all connected views
    for (const [viewId, connectedView] of this.connectedViews.entries()) {
      if (!connectedView.view.visible && this.queueHiddenEvents) {
        this.enqueueEvent(connectedView, event, viewId);
        continue;
      }

      this.postEventToView(
        connectedView,
        event,
        viewId,
        (error) => {
          this.pruneConnectedView(
            viewId,
            connectedView,
            `Failed to send event ${String(key)} to view ${connectedView.context.viewType}:${viewId}: ${getErrorMessage(error)}`
          );
        },
        () => {
          if (!this.queueHiddenEvents) {
            this.logger.warn(
              `Event ${String(key)} was not delivered to view ${connectedView.context.viewType}:${viewId}`
            );
            return;
          }

          this.logger.warn(
            `Event ${String(key)} was not delivered to view ${connectedView.context.viewType}:${viewId}; re-queueing`
          );
          if (this.connectedViews.get(viewId) === connectedView) {
            this.enqueueEvent(connectedView, event, viewId);
          }
        }
      );
    }
  }

  /**
   * Register a webview with this API provider
   */
  registerView(id: WebviewKey, view: vscode.WebviewView): void {
    if (this.connectedViews.has(id) && view === this.connectedViews.get(id)?.view) {
      this.logger.error(`Webview ${id} already registered`);
      return;
    }

    const context: RequestContext = {
      viewId: id,
      viewType: view.viewType,
      timestamp: Date.now(),
      sessionId: generateId('session'),
    };

    this.connectedViews.set(id, { view, context, pendingEvents: [] });
    this.logger.info(`Registered webview: ${view.viewType}:${id}`);

    const visibilityListener = view.onDidChangeVisibility(() => {
      if (view.visible) {
        this.flushPendingEvents(id);
      }
    });
    this.disposables.push(visibilityListener);

    // Clean up on dispose
    const disposeListener = view.onDidDispose(() => {
      visibilityListener.dispose();
      if (this.connectedViews.get(id)?.view === view) {
        this.connectedViews.delete(id);
        this.logger.info(`Unregistered webview: ${view.viewType}:${id}`);
      }
    });
    this.disposables.push(disposeListener);
  }

  /**
   * Get the number of connected views (useful for testing)
   */
  getConnectedViewCount(): number {
    return this.connectedViews.size;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.connectedViews.clear();
    this.logger.info('WebviewApiProvider disposed');
  }

  private enqueueEvent(connectedView: ConnectedView<T>, event: ViewApiEvent<T>, viewId: string) {
    if (this.maxQueuedEvents <= 0) {
      this.logger.warn(
        `Dropping event '${String(event.key)}' for hidden view ${connectedView.context.viewType}:${viewId}: maxQueuedEvents is ${String(this.maxQueuedEvents)}`
      );
      return;
    }

    if (connectedView.pendingEvents.length >= this.maxQueuedEvents) {
      const dropped = connectedView.pendingEvents.shift();
      this.logger.warn(
        `Event queue for hidden view ${connectedView.context.viewType}:${viewId} is full (${String(this.maxQueuedEvents)}); dropping oldest event '${String(dropped?.key)}'`
      );
    }
    connectedView.pendingEvents.push(event);
  }

  /**
   * Flush events queued while a view was hidden
   */
  private flushPendingEvents(id: WebviewKey): void {
    const connectedView = this.connectedViews.get(id);
    if (
      connectedView === undefined ||
      !connectedView.view.visible ||
      connectedView.pendingEvents.length === 0
    ) {
      return;
    }

    const queued = connectedView.pendingEvents.splice(0);
    this.logger.debug(
      `Flushing ${String(queued.length)} queued event(s) to view ${connectedView.context.viewType}:${id}`
    );

    for (const event of queued) {
      if (this.connectedViews.get(id) !== connectedView) {
        break;
      }

      this.postEventToView(
        connectedView,
        event,
        id,
        (error) => {
          this.pruneConnectedView(
            id,
            connectedView,
            `Failed to flush event ${String(event.key)} to view ${connectedView.context.viewType}:${id}: ${getErrorMessage(error)}`
          );
        },
        () => {
          this.logger.warn(
            `Event ${String(event.key)} was not delivered while flushing ${connectedView.context.viewType}:${id}; re-queueing`
          );
          if (this.connectedViews.get(id) === connectedView) {
            this.enqueueEvent(connectedView, event, id);
          }
        }
      );
    }
  }

  private postEventToView(
    connectedView: ConnectedView<T>,
    event: ViewApiEvent<T>,
    viewId: WebviewKey,
    onFailure: (error: unknown) => void,
    onNotDelivered: () => void
  ): void {
    // eslint-disable-next-line sonarjs/no-try-promise
    try {
      void connectedView.view.webview.postMessage(event).then(
        (delivered) => {
          if (!delivered && this.connectedViews.get(viewId) === connectedView) {
            onNotDelivered();
          }
        },
        (error: unknown) => {
          if (this.connectedViews.get(viewId) === connectedView) {
            onFailure(error);
          }
        }
      );
    } catch (error) {
      if (this.connectedViews.get(viewId) === connectedView) {
        onFailure(error);
      }
    }
  }

  private pruneConnectedView(
    viewId: WebviewKey,
    connectedView: ConnectedView<T>,
    reason: string
  ): void {
    if (this.connectedViews.get(viewId) !== connectedView) {
      this.logger.debug(
        `Ignoring stale failure for webview ${connectedView.context.viewType}:${viewId}`
      );
      return;
    }

    this.logger.error(reason);
    this.logger.warn(
      `Removing failed webview ${connectedView.context.viewType}:${viewId} from connectedViews`
    );
    this.connectedViews.delete(viewId);
  }
}
