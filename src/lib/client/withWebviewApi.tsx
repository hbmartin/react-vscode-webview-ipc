import type { ComponentType, FC } from 'react';
import { createCtxKey } from './useWebviewApi';
import { WebviewProvider } from './WebviewProvider';

/**
 * Higher-order component to ensure WebviewProvider is available
 */
export function withWebviewApi<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  const WrappedComponent: FC<P> = (props: P) => {
    return (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      <WebviewProvider viewType={Component.name} contextKey={createCtxKey(Component.name)}>
        <Component {...props} />
      </WebviewProvider>
    );
  };

  WrappedComponent.displayName = `withWebviewApi(${Component.displayName ?? Component.name})`;

  return WrappedComponent;
}
