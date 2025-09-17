import { useContext, type Context } from 'react';
import type { ClientCalls, CtxKey } from '../types';
import type { WebviewContextValue } from './WebviewContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TypedContexts = new WeakMap<CtxKey<any>, Context<any>>();

export const useWebviewApi = <T extends ClientCalls>(
  contextKey: CtxKey<T>
): WebviewContextValue<T> => {
  // eslint-disable-next-line sonarjs/no-empty-collection
  if (!TypedContexts.has(contextKey)) {
    throw new Error('useWebviewApi must be used within WebviewProvider with matching key');
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, sonarjs/no-empty-collection
  const context = useContext(TypedContexts.get(contextKey)!);
  if (context === undefined) {
    throw new Error('useWebviewApi must be used within WebviewProvider with matching key');
  }
  return context as WebviewContextValue<T>;
};

export function createCtxKey<T extends ClientCalls>(contextKey: string): CtxKey<T> {
  return Object.freeze({ id: Symbol(contextKey) }) as CtxKey<T>;
}
