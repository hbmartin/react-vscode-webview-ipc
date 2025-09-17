import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACT, type Patch, PATCH, type Action, type WebviewKey } from '../types/reducer';
import { isFnKey } from './ipcReducer';
import type { StateReducer, VsCodeApi } from './types';

type PostAction<A extends object> = Pick<Action<A>, 'key' | 'params'>;

function isMyPatchMessage<A extends object>(message: unknown, id: WebviewKey): message is Patch<A> {
  return (
    message !== null &&
    message !== undefined &&
    typeof message === 'object' &&
    'providerId' in message &&
    'type' in message &&
    'key' in message &&
    'patch' in message &&
    message.type === PATCH &&
    typeof message.providerId === 'string' &&
    message.providerId === id
  );
}

const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);

export function useVscodeState<S, A extends object>(
  vscode: VsCodeApi,
  providerId: WebviewKey,
  postReducer: StateReducer<S, A>,
  initialState: S | (() => S)
): readonly [S, A] {
  const [state, setState] = useState<S>(
    typeof initialState === 'function' ? (initialState as () => S)() : initialState
  );
  const validKeys = useMemo(
    () => new Set(Object.keys(postReducer).filter((k) => !dangerousKeys.has(k))),
    [postReducer]
  );

  useEffect(() => {
    const handler = (event: MessageEvent<unknown>) => {
      const { data } = event;
      if (isMyPatchMessage<A>(data, providerId)) {
        if (
          validKeys.has(String(data.key)) &&
          Object.prototype.hasOwnProperty.call(postReducer, data.key) &&
          typeof postReducer[data.key] === 'function'
        ) {
          const patchFn = postReducer[data.key];
          setState((prev) => patchFn(prev, data.patch));
        } else {
          throw new Error(`Could not find a function for ${String(data.key)} in postReducer`);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, [postReducer, providerId, validKeys]);

  const postAction = useCallback(
    (arg: PostAction<A>) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
      if (vscode === undefined) {
        throw new Error('Vscode api is undefined');
      }

      vscode.postMessage({
        type: ACT,
        providerId: providerId,
        key: arg.key,
        params: arg.params,
      } satisfies Action<A>);
    },
    [vscode, providerId]
  );

  const actor = new Proxy({} as A, {
    // eslint-disable-next-line code-complete/enforce-meaningful-names
    get(_, prop) {
      if (typeof prop !== 'string' && typeof prop !== 'symbol') {
        throw new TypeError(`Invalid action type: ${String(prop)}`);
      }
      if (typeof prop === 'string' && dangerousKeys.has(prop)) {
        throw new Error(`Dangerous action key is blocked: ${prop}`);
      }
      if (!isFnKey(prop, postReducer)) {
        throw new Error(`Unknown or invalid action: ${String(prop)}`);
      }
      return (...args: unknown[]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params = args as A[typeof prop] extends (...args: unknown[]) => any
          ? Parameters<A[typeof prop]>
          : never;

        postAction({
          key: prop,
          params,
        } satisfies PostAction<A>);
      };
    },
  });

  return [state, actor] as const;
}
