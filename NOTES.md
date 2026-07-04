# NOTES

This file captures implementation questions, potential concerns, and concrete opportunities to improve the architecture.

## Questions

- Host RPC router helper?
  - The library provides `isViewApiRequest` and a `WebviewApiProvider` (for host→webview events) but not a host-side request router. Is the intent that extensions implement their own router inside `handleMessage`? Consider providing a tiny helper to map `key` → handler table and handle response/error boilerplate.

- `providerId` vs. view instance identity?
  - `BaseWebviewViewProvider` registers the view with `apiProvider.registerView(this.providerId, webviewView)`. That uses the provider/viewType as the key. This is fine for WebviewView (one per viewType). If this were used with multiple panels/instances, would we want unique per-instance ids?

- `WebviewProvider` + `acquireVsCodeApi`
  - `WebviewProvider` eagerly calls `acquireVsCodeApi()` at module runtime. That’s correct inside VS Code but makes testing harder (no fallback), and SSR/static analysis tools may trip. Should we support a prop to inject a fake `vscode` for tests or lazily acquire it?

- Timeouts for RPC requests?
  - `DeferredPromise` has `timeoutHandle` and `clearTimeout`, but no default timeout is set in `WebviewProvider`. Should there be an optional timeout per call or a provider-level default?

- Stronger host event typing in WebviewProvider?
  - `WebviewProvider` is generic `<T extends ClientCalls, H extends HostCalls>` but internally uses `HostCalls` for listeners, not `H`. Is this deliberate to keep the surface generic, or should the type param be threaded through for stricter webview-side typing of `addListener/removeListener`?

## Potential Concerns

- Mixed message listeners
  - Both `useVscodeState` and `WebviewProvider` attach `window.addEventListener('message', ...)`. They co-exist fine (RPC provider ignores `providerId` messages), but a single consolidated dispatcher could reduce overhead and make ordering explicit.

- Actor return values
  - The reducer actor methods (from `useVscodeState`) don’t return anything (fire-and-forget). This is fine by design, but it’s worth documenting to avoid expectations of awaiting results (use RPC when you need a response).

- Prototype pollution guard
  - `useVscodeState` blocks dangerous keys (`__proto__`, `constructor`, `prototype`). Good call. It might be worth logging a friendlier message listing allowed action keys as a hint during development.

- Error handling pathways
  - `BaseWebviewViewProvider` posts `patch` blindly; failures on the webview side are only visible via console. Consider optional ack/diagnostic logs or a dev-mode check to warn if no webview is present.

- Event pruning policy
  - `WebviewApiProvider.triggerEvent` prunes failed webviews (good!). We may want metric counters or a diagnostic log level to help extensions observe churn.

## Opportunities for Improvement

- Add a typed host RPC router
  - Provide a small `RpcRouter<T extends ClientCalls>` helper:
    - `router.register('method', handler)`
    - `router.handle(message, webview)` → auto `response`/`error` handling.
    - Optionally middleware for auth/validation/logging.

- Unify message pump on webview side
  - Offer a single `WebviewMessageBus` (hook or utility) that both `useVscodeState` and `WebviewProvider` can use to subscribe to specific message types, reducing duplicate listeners.

- Optional RPC call timeouts
  - Add an optional timeout to `callApi` signature or a `WebviewProvider` prop (`requestTimeoutMs`) to reject hung calls with a clear error.

- Lazy/vended `vscode` for tests
  - Let `WebviewProvider` accept an optional `vscode` prop, falling back to `acquireVsCodeApi()` if not provided. This improves testability and SSR resilience.

- Stronger event typing in webview
  - Thread the `H extends HostCalls` generic throughout the listener map in `WebviewProvider` so `addListener/removeListener` are fully typed to the specific host events for the view.

- Convenience helpers
  - Provide a helper to brand a `string` into `WebviewKey` (e.g., `asWebviewKey(id: string)`)
  - Provide a `BaseWebviewPanelProvider` mirroring `BaseWebviewViewProvider` for multi-instance panels with per-panel ids.

- Docs and examples
  - Add a small example extension repo showing both paradigms together, with a build script that drops webview assets to `dist/` and a smoke test that verifies message roundtrips.

## Validation Ideas

- Unit test: `useVscodeState` dangerous key filtering and action key verification errors.
- Unit test: `WebviewProvider` pending request lifecycle (resolve/reject, unmount cleanup, missing id handling).
- E2E: reducer action dispatch → host delegate → patch → reducer applies; RPC request/response and host→webview event broadcast.
