# React + VSCode Webview = IPC

[![npm version](https://img.shields.io/npm/v/react-vscode-webview-ipc?color=green)](https://www.npmjs.com/package/react-vscode-webview-ipc)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hbmartin/react-vscode-webview-ipc)
[![CI](https://github.com/hbmartin/react-vscode-webview-ipc/actions/workflows/ci.yml/badge.svg)](https://github.com/hbmartin/react-vscode-webview-ipc/actions/workflows/ci.yml)
[![NPM License](https://img.shields.io/npm/l/react-vscode-webview-ipc?color=blue)](https://github.com/hbmartin/react-vscode-webview-ipc/blob/main/LICENSE.txt)

A small library to make two-way communication between a VS Code extension host and a React webview simple and type‑safe.

Two complementary paradigms are supported (you can use one or both):

- UDF reducer IPC: Dispatch actions from the webview; the host computes a patch; the webview applies it via a reducer. (unidirectional dataflow)
- RPC promises IPC: Call host functions from the webview and await typed results; the host can also push typed events to all connected webviews.

This README explains how to implement both and shows how they can coexist.

## Install

- Install the package in your VS Code extension project.

```
npm i react-vscode-webview-ipc
```

- You’ll consume two entry points:
  - `react-vscode-webview-ipc/host` for your extension host code
  - `react-vscode-webview-ipc/client` for your React webview code

## Concepts Overview

- WebviewKey: a branded string identifying your view instance. Use a stable id (often your view type).
- Messages:
  - Reducer IPC: `{ type: 'act' }` messages from webview → host; `{ type: 'patch' }` messages from host → webview; `{ type: 'actError' }` from host → webview when an action fails.
  - RPC IPC: `{ type: 'request' }` from webview → host; `{ type: 'response'|'error' }` from host → webview; `{ type: 'event' }` from host → webview broadcast.
- Logging: webview logs are forwarded to the host’s Output channel.

## UDF Reducer IPC (Action → Patch → Reduce)

Use this when your webview wants unidirectional state updates managed via a reducer.

### Types and Building Blocks

- On the webview:
  - `useVscodeState<S, A>(vscode, providerId, postReducer, initialState, options?)` returns `[state, actor]`.
    - `state: S` – your current state
    - `actor: A` – a proxy with methods matching your action interface
    - `options.onError?: (error, actionKey?) => void` – called when a patch arrives for an unknown reducer key, or when the host reports that an action failed (defaults to `console.error`)
  - `postReducer: StateReducer<S, A>` maps each action key to `(prevState, patch) => newState`.
- On the host:
  - Extend `BaseWebviewViewProvider<A>` and implement:
    - `webviewActionDelegate: ActionDelegate<A>` – map action keys to host handlers that return a patch (sync or async)
    - `generateWebviewHtml(webview, extensionUri)` – return the webview HTML
    - `handleMessage(message, webview)` – handle any messages you want besides reducer IPC (e.g., your RPC requests)
  - If a delegate throws or rejects (or the action key is unknown), the error is logged and an `{ type: 'actError' }` message is posted back to the webview (surfaced through `useVscodeState`'s `onError`). Override `onActionError(key, error)` to add custom host-side handling.
  - Optionally pass a `WebviewApiProvider` instance to the base class constructor to enable host→webview event broadcasting (RPC paradigm).
  - Optionally pass `BaseWebviewViewProviderOptions` as the 4th constructor argument: `{ queueHiddenMessages?: boolean; maxQueuedMessages?: number }`. By default, patches posted while the view is hidden (or not yet resolved) are queued (up to 100) and flushed when it becomes visible, instead of being silently dropped.

### Minimal Example

Host (extension):

```ts
// src/extension/MyViewProvider.ts
import * as vscode from 'vscode';
import { BaseWebviewViewProvider, type ActionDelegate } from 'react-vscode-webview-ipc/host';
import type { WebviewKey } from 'react-vscode-webview-ipc/client';

// 1) Define the action interface A: methods return the “patch” type
interface MyActions {
  increment: (by: number) => number; // patch is a number
  setMessage: (msg: string) => { message: string }; // patch is an object
}

export class MyViewProvider extends BaseWebviewViewProvider<MyActions> {
  protected readonly webviewActionDelegate: ActionDelegate<MyActions> = {
    increment: (by) => by, // just echo back the increment amount as the patch
    setMessage: (msg) => ({ message: msg }),
  };

  constructor(
    private readonly id: WebviewKey,
    private readonly ctx: vscode.ExtensionContext
  ) {
    // You can also pass a WebviewApiProvider instance as 3rd arg to enable events
    super(id, ctx.extensionUri);
  }

  protected generateWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview.css')
    );

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}">
    <title>My View</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="${scriptUri}"></script>
  </body>
</html>`;
  }

  protected async handleMessage(_message: unknown, _webview: vscode.Webview): Promise<void> {
    // No-op for reducer-only example. Use this for RPC too (see later).
  }
}
```

Register the provider in your extension activation:

```ts
// src/extension/activate.ts
import * as vscode from 'vscode';
import { MyViewProvider } from './MyViewProvider';

export function activate(context: vscode.ExtensionContext) {
  const viewType = 'myExtension.myView' as unknown as WebviewKey; // brand to WebviewKey
  const provider = new MyViewProvider(viewType, context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(viewType, provider));
}
```

Webview (React):

```tsx
// src/webview/App.tsx
import { useMemo } from 'react';
import {
  useVscodeState,
  type StateReducer,
  type WebviewKey,
} from 'react-vscode-webview-ipc/client';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): Thenable<boolean>;
  getState(): unknown;
  setState(state: unknown): void;
};

interface State {
  count: number;
  message: string;
}
interface MyActions {
  increment: (by: number) => number;
  setMessage: (msg: string) => { message: string };
}

const initial: State = { count: 0, message: '' };

const reducers: StateReducer<State, MyActions> = {
  increment: (prev, by) => ({ ...prev, count: prev.count + by }),
  setMessage: (prev, patch) => ({ ...prev, message: patch.message }),
};

export default function App() {
  const vscode = useMemo(() => acquireVsCodeApi(), []);
  const providerId = 'myExtension.myView' as unknown as WebviewKey;
  const [state, act] = useVscodeState(vscode, providerId, reducers, initial);

  return (
    <div>
      <p>Count: {state.count}</p>
      <p>Message: {state.message}</p>
      <button onClick={() => act.increment(1)}>+1</button>
      <button onClick={() => act.setMessage('Hello!')}>Set Message</button>
    </div>
  );
}
```

### UDF Flow (Sequence)

```mermaid
sequenceDiagram
  participant W as Webview (React)
  participant VS as VS Code API
  participant H as Extension Host
  W->>VS: postMessage { type: 'act', providerId, key, params }
  VS->>H: onDidReceiveMessage(message)
  alt success
    H->>H: webviewActionDelegate[key](...params) => patch
    H-->>VS: postMessage { type: 'patch', providerId, key, patch }
    VS-->>W: window message
    W->>W: postReducer[key](prev, patch) => newState
  else delegate throws / unknown key
    H-->>VS: postMessage { type: 'actError', providerId, key, error }
    VS-->>W: window message
    W->>W: options.onError(error, key)
  end
```

## RPC Promises IPC (Typed Requests/Responses + Events)

Use this when your webview needs to call host functions and await results. The host can also broadcast typed events back to all connected webviews.

### Types and Building Blocks

- On the webview:
  - Wrap your app in `<WebviewProvider viewType contextKey>`.
  - Use `createCtxKey<T>()` to create a unique key tying the context to your API type `T`.
  - Call `const { api, addListener, removeListener, vscode } = useWebviewApi(ctxKey)` inside components.
    - `api.method(...)` returns a promise (typed from your `ClientCalls` interface).
    - `addListener('eventKey', cb)` / `removeListener(...)` manage host-pushed events.
  - Requests time out (rejecting the promise) if the host never replies. The default is 30s (`DEFAULT_REQUEST_TIMEOUT_MS`); tune it with `<WebviewProvider requestTimeoutMs={5000}>`, or pass `0` to disable timeouts.
- On the host:
  - Create a `WebviewApiProvider<HostEvents>()` and pass it to your `BaseWebviewViewProvider` constructor (to register views for events).
  - In your provider’s `handleMessage`, detect requests via `isViewApiRequest(message)`, dispatch to your host API handlers, and respond with `{ type: 'response'|'error', id, value }`.
  - Use `apiProvider.triggerEvent('eventKey', ...args)` to broadcast events to connected webviews. Events for hidden views are queued per view (up to 100 by default) and flushed when the view becomes visible; configure via `new WebviewApiProvider({ queueHiddenEvents, maxQueuedEvents })`.

### Minimal Example

Shared types:

```ts
// Host receives these requests from the webview (must return promises)
import type { ClientCalls } from 'react-vscode-webview-ipc/client';
import type { HostCalls } from 'react-vscode-webview-ipc/client';

export interface MyClientApi extends ClientCalls {
  fetchGreeting: (name: string) => Promise<string>;
  saveCount: (count: number) => Promise<void>;
}

// Host can push these events to all webviews
export interface MyHostEvents extends HostCalls {
  onTick: (count: number) => void;
}
```

Host (extension):

```ts
import * as vscode from 'vscode';
import {
  BaseWebviewViewProvider,
  WebviewApiProvider,
  isViewApiRequest,
  type ViewApiResponse,
  type ViewApiError,
} from 'react-vscode-webview-ipc/host';
import type { MyClientApi, MyHostEvents } from './types';
import type { WebviewKey } from 'react-vscode-webview-ipc/client';

export class MyRpcViewProvider extends BaseWebviewViewProvider<{}> {
  protected readonly webviewActionDelegate = {}; // not using reducer actions here

  constructor(
    private readonly id: WebviewKey,
    private readonly ctx: vscode.ExtensionContext,
    private readonly api = new WebviewApiProvider<MyHostEvents>()
  ) {
    super(id, ctx.extensionUri, api);
  }

  protected generateWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.ctx.extensionUri, 'dist', 'webview.js')
    );
    return `<div id="root"></div><script src="${scriptUri}"></script>`;
  }

  protected async handleMessage(message: unknown, webview: vscode.Webview): Promise<void> {
    if (isViewApiRequest<MyClientApi>(message)) {
      try {
        switch (message.key) {
          case 'fetchGreeting': {
            const [name] = message.params;
            const value = `Hello, ${name}!`;
            const response: ViewApiResponse<MyClientApi, 'fetchGreeting'> = {
              type: 'response',
              id: message.id,
              value,
            };
            await webview.postMessage(response);
            return;
          }
          case 'saveCount': {
            const [count] = message.params;
            // persist count...
            const response: ViewApiResponse<MyClientApi, 'saveCount'> = {
              type: 'response',
              id: message.id,
            };
            await webview.postMessage(response);
            return;
          }
        }
        const error: ViewApiError = {
          type: 'error',
          id: message.id,
          value: `Unknown method: ${String(message.key)}`,
        };
        await webview.postMessage(error);
      } catch (e) {
        const error: ViewApiError = {
          type: 'error',
          id: message.id,
          value: e instanceof Error ? e.message : String(e),
        };
        await webview.postMessage(error);
      }
    }
  }
}

// elsewhere in your extension, you can broadcast events
// provider.api.triggerEvent('onTick', currentCount)
```

Webview (React):

```tsx
import React, { useEffect } from 'react';
import {
  WebviewProvider,
  useWebviewApi,
  createCtxKey,
  type CtxKey,
} from 'react-vscode-webview-ipc/client';
import type { MyClientApi, MyHostEvents } from './types';

const Ctx: CtxKey<MyClientApi> = createCtxKey<MyClientApi>('my-rpc');

function Inner() {
  const { api, addListener, removeListener } = useWebviewApi(Ctx);

  useEffect(() => {
    const onTick = (n: number) => console.log('tick', n);
    addListener('onTick', onTick as MyHostEvents['onTick']);
    return () => removeListener('onTick', onTick as MyHostEvents['onTick']);
  }, [addListener, removeListener]);

  useEffect(() => {
    (async () => {
      const greeting = await api.fetchGreeting('VS Code');
      console.log(greeting);
      await api.saveCount(42);
    })();
  }, [api]);

  return <div />;
}

export default function App() {
  return (
    <WebviewProvider<MyClientApi> viewType="myExtension.myView" contextKey={Ctx}>
      <Inner />
    </WebviewProvider>
  );
}
```

### RPC Flow (Sequence)

```mermaid
sequenceDiagram
  participant W as Webview (React)
  participant VS as VS Code API
  participant H as Extension Host
  W->>VS: postMessage { type: 'request', id, key, params, context }
  VS->>H: onDidReceiveMessage(message)
  alt success
    H-->>VS: postMessage { type: 'response', id, value }
    VS-->>W: resolve pending promise
  else error
    H-->>VS: postMessage { type: 'error', id, value }
    VS-->>W: reject pending promise
  end
  H-->>VS: postMessage { type: 'event', key, value[] }
  VS-->>W: Invoke registered listeners for key
```

## Using Both Paradigms Together

- They are designed to coexist. The webview can dispatch reducer actions for state, and call RPC methods for imperative operations.
- The library ensures messages don’t conflict:
  - `useVscodeState` listens for `{ providerId, type: 'patch' }` and `{ providerId, type: 'actError' }` messages.
  - `WebviewProvider` listens for `{ type: 'response'|'error'|'event' }` messages and ignores messages with `providerId` present.
- In your host provider, `resolveWebviewView` (from the base class) handles reducer `act/patch` automatically; implement `handleMessage` for RPC requests.

## Logging

- Webview: `useLogger(tag, vscode)` returns a logger that posts to the host output channel.
- Host: `getLogger(tag)` returns an Output channel logger; `BaseWebviewViewProvider` automatically routes webview log messages to it.

Webview example:

```ts
import { useLogger } from 'react-vscode-webview-ipc/client';
const logger = useLogger('MyView', acquireVsCodeApi());
logger.info('hello');
```

## Tips & Troubleshooting

- Brand your view type to `WebviewKey` at the edges to keep types happy: `const id = 'ext.view' as unknown as WebviewKey`.
- Always use stable `providerId`s; the reducer IPC ties messages to a specific provider.
- Clean up listeners on unmount in the webview.
- When posting RPC responses/errors from the host, always echo the same `id` you received.
- If you use both paradigms, keep your reducer patches focused on state updates and use RPC for IO or long‑running tasks.

## API Surface (Quick Reference)

Host exports (`react-vscode-webview-ipc/host`):

- `BaseWebviewViewProvider<A>` (constructor accepts `BaseWebviewViewProviderOptions` for hidden-view message queueing; override `onActionError(key, error)` to observe action failures)
- `WebviewApiProvider<T extends HostCalls>` (constructor accepts `WebviewApiProviderOptions` for hidden-view event queueing)
- `isViewApiRequest(message)`
- `Logger`, `getLogger`, `disallowedLogKeys`
- Types: `ActionDelegate`, `ActionError`, `BaseWebviewViewProviderOptions`, `WebviewApiProviderOptions`

Client exports (`react-vscode-webview-ipc/client`):

- `WebviewProvider<T extends ClientCalls>` (accepts a `requestTimeoutMs` prop; `DEFAULT_REQUEST_TIMEOUT_MS` is 30s)
- `useWebviewApi(ctxKey)` and `createCtxKey<T>()`
- `useVscodeState<S, A>(vscode, providerId, postReducer, initial, options?)`
- `useLogger(tag, vscode)`
- Types: `ClientCalls`, `HostCalls`, `CtxKey`, `WebviewKey`, `StateReducer`, `UseVscodeStateOptions`

## Robustness Behavior

- RPC requests reject with a timeout error if the host never responds when timeouts are enabled (default 30s, configurable per provider via `requestTimeoutMs`, disable with `0`), bounding pending promises for the enabled case.
- Reducer action failures on the host (unknown action key, or a delegate that throws/rejects) are logged, reported to the provider's `onActionError` hook, and posted back to the webview as `{ type: 'actError' }` — surfaced via `useVscodeState`'s `onError` option. Message handlers never throw into the void.
- Patches and events destined for hidden (or not-yet-resolved) webviews are queued — bounded, oldest-first eviction — and flushed automatically when the view becomes visible, instead of being silently dropped. Both queues can be disabled or resized via the constructor options above.

## References

- [vscode-messenger](https://github.com/TypeFox/vscode-messenger)
- [Navigating the VS Code Extensions Structure](https://medium.com/@chajesse/from-learner-to-contributor-navigating-the-vs-code-extensions-structure-ed150f9897e5)
- [How to Build a VS Code Extension using React Webviews](https://medium.com/snowflake/how-to-build-a-vs-code-extension-using-react-webviews-0e2481ce1ba2)
- [How to Pass Data to A Webview Panel in VS Code Extension API](https://medium.com/@ashleyluu87/data-flow-from-vs-code-extension-webview-panel-react-components-2f94b881467e)

## Legal

- [Apache 2.0 License](LICENSE.txt)
- Visual Studio Code, VS Code, and the Visual Studio Code icon are trademarks of Microsoft Corporation.
