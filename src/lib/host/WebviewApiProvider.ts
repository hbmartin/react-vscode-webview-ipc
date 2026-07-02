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

    // Track views that fail to receive messages
    const failedViews: string[] = [];

    // Send to all connected views
    for (const [viewId, connectedView] of this.connectedViews.entries()) {
      if (!connectedView.view.visible && this.queueHiddenEvents) {
        this.enqueueEvent(connectedView, event, viewId);
        continue;
      }

      // eslint-disable-next-line sonarjs/no-try-promise
      try {
        const postPromise = connectedView.view.webview.postMessage(event);

        // Handle async failures
        postPromise.then(
          () => {
            // Message sent successfully
          },
          (error: unknown) => {
            this.logger.error(
              `Failed to send event ${String(key)} to view ${connectedView.context.viewType}:${viewId}: ${getErrorMessage(error)}`
            );

            // Mark view for removal
            failedViews.push(viewId);
          }
        );
      } catch (error) {
        // Handle synchronous exceptions from postMessage
        this.logger.error(
          `Exception while sending event ${String(key)} to view ${connectedView.context.viewType}:${viewId}: ${String(error)}`
        );

        // Mark view for removal
        failedViews.push(viewId);
      }
    }

    // Prune failed views after iteration to avoid modifying collection during iteration
    if (failedViews.length > 0) {
      for (const viewId of failedViews) {
        const connectedView = this.connectedViews.get(viewId as WebviewKey);
        if (connectedView) {
          this.logger.warn(
            `Removing failed webview ${connectedView.context.viewType}:${viewId} from connectedViews`
          );

          // Only remove from connected views - let webviews handle their own disposal lifecycle
          this.connectedViews.delete(viewId as WebviewKey);
        }
      }

      this.logger.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Removed ${failedViews.length} failed webview(s) from connectedViews. Remaining: ${this.connectedViews.size}`
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

    // Clean up on dispose
    view.onDidDispose(() => {
      visibilityListener.dispose();
      this.connectedViews.delete(id);
      this.logger.info(`Unregistered webview: ${view.viewType}:${id}`);
    });
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
      // eslint-disable-next-line sonarjs/no-try-promise
      try {
        connectedView.view.webview.postMessage(event).then(
          () => {
            // Message sent successfully
          },
          (error: unknown) => {
            this.logger.error(
              `Failed to flush event ${String(event.key)} to view ${connectedView.context.viewType}:${id}: ${getErrorMessage(error)}`
            );
          }
        );
      } catch (error) {
        this.logger.error(
          `Exception while flushing event ${String(event.key)} to view ${connectedView.context.viewType}:${id}: ${String(error)}`
        );
      }
    }
  }
}
