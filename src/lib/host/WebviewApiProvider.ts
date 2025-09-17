import type { HostCalls, RequestContext, ViewApiEvent } from '../types';
import { generateId, getErrorMessage } from '../utils';
import { getLogger } from './logger';
import type { WebviewKey } from '../types/reducer';
import type * as vscode from 'vscode';

/**
 * WebviewApiProvider implements the type-safe API contract between host and webviews.
 * It handles all API calls and event dispatching with full type safety.
 */
interface ConnectedView {
  view: vscode.WebviewView;
  context: RequestContext;
}

export class WebviewApiProvider<T extends HostCalls> implements vscode.Disposable {
  private readonly connectedViews = new Map<WebviewKey, ConnectedView>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly logger = getLogger('WebviewApiProvider');

  /**
   * Type-safe event triggering to all connected webviews
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

    this.connectedViews.set(id, { view, context });
    this.logger.info(`Registered webview: ${view.viewType}:${id}`);

    // Clean up on dispose
    view.onDidDispose(() => {
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
}
