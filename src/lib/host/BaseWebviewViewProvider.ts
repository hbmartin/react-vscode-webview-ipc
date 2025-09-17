import * as vscode from 'vscode';
import type { HostCalls } from '../types';
import {
  isMyActionMessage,
  PATCH,
  type ActionDelegate,
  type FnKeys,
  type Patch,
  type Patches,
  type WebviewKey,
} from '../types/ipcReducer';
import { LogLevel } from './ILogger';
import { getLogger } from './logger';
import { isLogMessage, type LogMessage } from './WebviewLogger';
import type { WebviewApiProvider } from './WebviewApiProvider';

export abstract class BaseWebviewViewProvider<A extends object>
  implements vscode.WebviewViewProvider
{
  protected _view?: vscode.WebviewView;
  protected readonly logger;
  protected abstract readonly webviewActionDelegate: ActionDelegate<A>;
  constructor(
    private readonly providerId: WebviewKey,
    private readonly extensionUri: vscode.Uri,
    private readonly apiProvider?: WebviewApiProvider<HostCalls>
  ) {
    this.logger = getLogger(providerId.split('.')[1]);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Thenable<void> | void {
    this.logger.debug('Resolving webview view');
    this._view = webviewView;

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
      if (isLogMessage(message)) {
        this.handleLogMessage(message);
        return;
      }
      if (isMyActionMessage<A>(message, this.providerId)) {
        this.logger.debug('Received action message from webview', { message });

        const delegateFn = this.webviewActionDelegate[message.key];
        if (typeof delegateFn !== 'function') {
          throw new TypeError(`Unknown action key: ${String(message.key)}`);
        }

        const patch = await delegateFn(...message.params);

        this._view?.webview.postMessage({
          type: PATCH,
          providerId: this.providerId,
          key: message.key,
          patch,
        });
        return;
      }

      await this.handleMessage(message, webviewView.webview);
    });

    // Dispose of the message listener when webview is disposed
    webviewView.onDidDispose(() => {
      messageListener.dispose();
      this.onWebviewDispose();
    });
  }

  public postPatch<K extends FnKeys<A> = FnKeys<A>>(key: K, patch: Patches<A>[K]) {
    this._view?.webview.postMessage({
      type: PATCH,
      providerId: this.providerId,
      key,
      patch,
    } satisfies Patch<A>);
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

  protected abstract generateWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string;

  protected abstract handleMessage(message: unknown, webview: vscode.Webview): Promise<void>;
}
