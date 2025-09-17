import { useContext, type ComponentType, type FC } from 'react';
import { WebviewContext } from './WebviewContext';
import { WebviewProvider } from './WebviewProvider';
import type { WebviewContextValue } from './types';

/**
 * Hook to access the webview API
 */
export const useWebviewApi = (): WebviewContextValue => {
  const context = useContext(WebviewContext);
  if (!context) {
    throw new Error('useWebviewApi must be used within WebviewProvider');
  }
  return context;
};

/**
 * Higher-order component to ensure WebviewProvider is available
 */
export function withWebviewApi<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  const WrappedComponent: FC<P> = (props) => {
    return (
      <WebviewProvider viewType={Component.name}>
        <Component {...props} />
      </WebviewProvider>
    );
  };

  WrappedComponent.displayName = `withWebviewApi(${Component.displayName ?? Component.name})`;

  return WrappedComponent;
}
