import * as vscode from 'vscode';
import { type HostCalls, type ILogger, isLogMessage, LogLevel, type LogMessage } from '../types';
import {
  ACT_ERROR,
  PATCH,
  type ActionDelegate,
  type ActionError,
  type FnKeys,
  type Patch,
  type Patches,
  type WebviewKey,
} from '../types/reducer';
import { getLogger } from './logger';
import { isMyActionMessage } from './utils';
import type { WebviewApiProvider } from './WebviewApiProvider';

export interface BaseWebviewViewProviderOptions {
  /**
   * When true (the default), patches and action errors posted while the
   * webview is hidden (or not yet resolved) are queued and flushed when the
   * view becomes visible, instead of being silently dropped by VS Code.
   */
  queueHiddenMessages?: boolean;
  /** Maximum number of queued messages kept while hidden. Defaults to 100. */
  maxQueuedMessages?: number;
}

// eslint-disable-next-line code-complete/no-magic-numbers-except-zero-one
const DEFAULT_MAX_QUEUED_MESSAGES = 100;
// eslint-disable-next-line code-complete/no-magic-numbers-except-zero-one
const PROVIDER_ID_SPLIT_LIMIT = 2;

export abstract class BaseWebviewViewProvider<A extends object>
  implements vscode.WebviewViewProvider
{
  protected _view?: vscode.WebviewView;
  protected readonly logger: ILogger;
  private readonly queueHiddenMessages: boolean;
  private readonly maxQueuedMessages: number;
  private readonly outbox: (Patch<A> | ActionError)[] = [];
  private hasResolvedView = false;
  protected abstract readonly webviewActionDelegate: ActionDelegate<A>;

  constructor(
    private readonly providerId: WebviewKey,
    private readonly extensionUri: vscode.Uri,
    private readonly apiProvider?: WebviewApiProvider<HostCalls>,
    options?: BaseWebviewViewProviderOptions
  ) {
    this.logger = getLogger(providerId.split('.', PROVIDER_ID_SPLIT_LIMIT)[1] ?? providerId);
    this.queueHiddenMessages = options?.queueHiddenMessages ?? true;
    this.maxQueuedMessages = options?.maxQueuedMessages ?? DEFAULT_MAX_QUEUED_MESSAGES;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Thenable<void> | void {
    this.logger.debug('Resolving webview view');
    this._view = webviewView;
    this.hasResolvedView = true;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'src', 'assets'),
      ],
    };

    webviewView.webview.html = this.generateWebviewHtml(webviewView.webview, this.extensionUri);

    this.apiProvider?.registerView(this.providerId, webviewView);

    const messageListener = webviewView.webview.onDidReceiveMessage(async (message) => {
      // Never let an exception escape this callback: it would surface as an
      // unhandled rejection that the consumer cannot catch.
      try {
        await this.dispatchMessage(message, webviewView.webview);
      } catch (error) {
        this.logger.error(
          `Unhandled error while processing webview message: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    const visibilityListener = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.flushOutbox();
      }
    });

    // Dispose of the listeners when webview is disposed
    webviewView.onDidDispose(() => {
      messageListener.dispose();
      visibilityListener.dispose();
      if (this._view === webviewView) {
        this._view = undefined;
        this.outbox.length = 0;
      }
      this.onWebviewDispose();
    });

    // Deliver anything that was posted before the view was resolved
    this.flushOutbox();
  }

  public postPatch<K extends FnKeys<A> = FnKeys<A>>(key: K, patch: Patches<A>[K]) {
    this.postOrQueue({
      type: PATCH,
      providerId: this.providerId,
      key,
      patch,
    } satisfies Patch<A>);
  }

  /**
   * Called when an action from the webview fails (unknown action key, or the
   * delegate threw / rejected). The failure is already logged and reported to
   * the webview as an `actError` message; override to add custom handling.
   */
  protected onActionError(_key: string, _error: Error): void {
    // Default implementation does nothing
    // Subclasses can override to observe action failures
  }

  /**
   * Called when the webview is disposed
   * Override this method to clean up resources
   */
  protected onWebviewDispose(): void {
    // Default implementation does nothing
    // Subclasses can override to clean up resources
  }

  protected handleLogMessage(message: LogMessage): void {
    switch (message.level) {
      case LogLevel.DEBUG: {
        this.logger.debug(message.message, message.data);
        break;
      }
      case LogLevel.INFO: {
        this.logger.info(message.message, message.data);
        break;
      }
      case LogLevel.WARN: {
        this.logger.warn(message.message, message.data);
        break;
      }
      case LogLevel.ERROR: {
        this.logger.error(message.message, message.data);
        break;
      }
    }
  }

  private async dispatchMessage(message: unknown, webview: vscode.Webview): Promise<void> {
    if (isLogMessage(message)) {
      this.handleLogMessage(message);
      return;
    }
    if (isMyActionMessage<A>(message, this.providerId)) {
      this.logger.debug('Received action message from webview', { message });

      const delegateFn = this.webviewActionDelegate[message.key];
      if (typeof delegateFn !== 'function') {
        this.handleActionFailure(
          String(message.key),
          new TypeError(`Unknown action key: ${String(message.key)}`)
        );
        return;
      }

      try {
        const patch = (await delegateFn(...message.params)) as Patches<A>[FnKeys<A>];
        this.postOrQueue({
          type: PATCH,
          providerId: this.providerId,
          key: message.key,
          patch,
        });
      } catch (error) {
        this.handleActionFailure(
          String(message.key),
          error instanceof Error ? error : new Error(String(error))
        );
      }
      return;
    }

    await this.handleMessage(message, webview);
  }

  /**
   * Logs a failed action, notifies `onActionError`, and posts an
   * `{ type: 'actError' }` message so the webview learns the action failed.
   */
  private handleActionFailure(key: string, error: Error): void {
    this.logger.error(`Action '${key}' failed: ${error.message}`);
    try {
      this.onActionError(key, error);
    } catch (hookError) {
      this.logger.error(
        `onActionError hook failed for action '${key}': ${hookError instanceof Error ? hookError.message : String(hookError)}`
      );
    }
    this.postOrQueue({
      type: ACT_ERROR,
      providerId: this.providerId,
      key,
      error: error.message,
    } satisfies ActionError);
  }

  private postOrQueue(message: Patch<A> | ActionError): void {
    const view = this._view;
    if (view?.visible === true) {
      void Promise.resolve(view.webview.postMessage(message)).then(
        (delivered) => {
          if (!delivered) {
            this.logger.warn(`Message of type '${message.type}' was not delivered to the webview`);
          }
        },
        (error: unknown) => {
          this.logger.error(
            `Failed to post message of type '${message.type}' to the webview: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      );
      return;
    }

    if (!this.queueHiddenMessages) {
      this.logger.warn(
        `Dropping message of type '${message.type}': webview is ${view === undefined ? 'not resolved' : 'hidden'}`
      );
      return;
    }

    if (view === undefined && this.hasResolvedView) {
      this.logger.warn(`Dropping message of type '${message.type}': webview is disposed`);
      return;
    }

    if (this.maxQueuedMessages <= 0) {
      this.logger.warn(
        `Dropping message of type '${message.type}': maxQueuedMessages is ${String(this.maxQueuedMessages)}`
      );
      return;
    }

    if (this.outbox.length >= this.maxQueuedMessages) {
      const dropped = this.outbox.shift();
      this.logger.warn(
        `Outbound queue is full (${String(this.maxQueuedMessages)}); dropping oldest message of type '${dropped?.type ?? 'unknown'}'`
      );
    }
    this.outbox.push(message);
  }

  private flushOutbox(): void {
    const view = this._view;
    if (view?.visible !== true || this.outbox.length === 0) {
      return;
    }
    const queued = this.outbox.splice(0);
    this.logger.debug(`Flushing ${String(queued.length)} queued message(s) to the webview`);
    for (const message of queued) {
      this.postOrQueue(message);
    }
  }

  protected abstract generateWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string;

  protected abstract handleMessage(message: unknown, webview: vscode.Webview): Promise<void>;
}
