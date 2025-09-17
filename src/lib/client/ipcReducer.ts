import type { FnKeys } from '../types/reducer';

export function isFnKey<T extends object>(
  prop: string | symbol | number,
  obj: T
): prop is FnKeys<T> {
  return (
    Object.prototype.hasOwnProperty.call(obj, prop) && typeof obj[prop as keyof T] === 'function'
  );
}
