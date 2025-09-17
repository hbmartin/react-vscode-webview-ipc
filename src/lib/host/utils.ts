import { ACT, type Action, type WebviewKey } from '../types/reducer';

export function isMyActionMessage<T extends object>(
  message: unknown,
  providerId: WebviewKey
): message is Action<T> {
  return (
    message !== null &&
    typeof message === 'object' &&
    !Array.isArray(message) &&
    'providerId' in message &&
    'type' in message &&
    'key' in message &&
    'params' in message &&
    message.type === ACT &&
    typeof message.providerId === 'string' &&
    message.providerId === providerId &&
    (typeof message.key === 'string' || typeof message.key === 'symbol') &&
    Array.isArray(message.params)
  );
}
