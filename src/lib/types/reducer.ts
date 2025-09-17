import type { Brand } from '.';

export type WebviewKey = Brand<string, 'WebviewKey'>;
export const PATCH = 'patch';
export const ACT = 'act';

export type FnKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

interface IpcMessage {
  readonly type: string;
  readonly providerId: WebviewKey;
}

export interface Action<T extends object, K extends FnKeys<T> = FnKeys<T>> extends IpcMessage {
  readonly type: typeof ACT;
  readonly key: K;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly params: T[K] extends (...a: infer A) => any ? Readonly<A> : never;
}

export type ActionDelegate<A> = {
  [K in FnKeys<A>]: A[K] extends (...args: infer P) => infer R
    ? (...args: P) => R | Promise<R>
    : never;
};

export interface Patch<A, K extends FnKeys<A> = FnKeys<A>> extends IpcMessage {
  readonly type: typeof PATCH;
  readonly key: K;
  readonly patch: Patches<A>[K];
}

export type Patches<A> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in FnKeys<A>]: A[K] extends (...args: any) => infer R
    ? R extends Promise<infer U>
      ? U
      : R
    : never;
};
