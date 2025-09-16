import * as vscode from 'vscode';
import type { ViewApiRequest, WebviewContext } from '../types';
import {
  isMyActionMessage,
  PATCH,
  type ActionDelegate,
  type FnKeys,
  type Patch,
  type Patches,
  type WebviewKey,
} from '../types/ipcReducer';
import { getLogger, Logger } from './logger';
import type { WebviewApiProvider } from './WebviewApiProvider';
import { isLogMessage } from './WebviewLogger';
import { LogLevel } from './ILogger';

export abstract class BaseWebviewViewProvider<A extends object>
  implements vscode.WebviewViewProvider
{
  protected _view?: vscode.WebviewView;
  protected readonly logger;
  protected abstract readonly webviewActionDelegate: ActionDelegate<A>;
  constructor(
    private readonly providerId: WebviewKey,
    private readonly extensionUri: vscode.Uri,
    private readonly apiProvider: WebviewApiProvider
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

    const webviewContext: WebviewContext = {
      layout: 'sidebar',
      extensionUri: this.extensionUri.toString(),
    };

    const html = this.generateWebviewHtml(webviewView.webview, this.extensionUri, webviewContext);

    webviewView.webview.html = html;

    this.apiProvider.registerView(this.providerId, webviewView, this.providerId);

    const messageListener = webviewView.webview.onDidReceiveMessage(async (message) => {
      if (isLogMessage(message)) {
        switch (message.level) {
          case LogLevel.DEBUG: {
            Logger.debug(message.message, message.data);
            break;
          }
          case LogLevel.INFO: {
            Logger.info(message.message, message.data);
            break;
          }
          case LogLevel.WARN: {
            Logger.warn(message.message, message.data);
            break;
          }
          case LogLevel.ERROR: {
            Logger.error(message.message, message.data);
            break;
          }
        }
      }
      if (isMyActionMessage<A>(message, this.providerId)) {
        this.logger.debug('Received action message from webview', message);

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

  protected abstract generateWebviewHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    context: WebviewContext
  ): string;

  protected abstract handleMessage(message: ViewApiRequest, webview: vscode.Webview): Promise<void>;
}
