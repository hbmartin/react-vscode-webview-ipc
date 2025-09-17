export * from './log';
export * from './rpc';

export type Brand<T, B> = T & { readonly __brand: B };
