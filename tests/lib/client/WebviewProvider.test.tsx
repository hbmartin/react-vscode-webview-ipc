import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  WebviewProvider,
} from '../../../src/lib/client/WebviewProvider';
import { createCtxKey, useWebviewApi } from '../../../src/lib/client/useWebviewApi';
import { mockVsCodeApi } from '../../setup/vitest.setup';
import type { ClientCalls } from '../../../src/lib/types';

interface TestCalls extends ClientCalls {
  testMethod: (arg: string) => Promise<string>;
}

function renderProvider(requestTimeoutMs?: number) {
  const contextKey = createCtxKey<TestCalls>('test');
  let api: ReturnType<typeof useWebviewApi<TestCalls>>['api'] | undefined;

  function Capture() {
    api = useWebviewApi(contextKey).api;
    return null;
  }

  render(
    <WebviewProvider
      viewType="test.view"
      contextKey={contextKey}
      requestTimeoutMs={requestTimeoutMs}
    >
      <Capture />
    </WebviewProvider>
  );

  if (api === undefined) {
    throw new Error('api was not captured');
  }
  return api;
}

function lastPostedRequest(): { id: string } {
  const call = mockVsCodeApi.postMessage.mock.calls.at(-1);
  if (call === undefined) {
    throw new Error('no request was posted');
  }
  return call[0] as { id: string };
}

describe('WebviewProvider request timeouts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject a pending request after the default timeout', async () => {
    const api = renderProvider();

    const promise = api.testMethod('hello');
    const rejection = expect(promise).rejects.toThrow(
      `Request 'testMethod' timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms`
    );

    act(() => {
      vi.advanceTimersByTime(DEFAULT_REQUEST_TIMEOUT_MS);
    });

    await rejection;
  });

  it('should reject after a custom provider-level timeout', async () => {
    const api = renderProvider(100);

    const promise = api.testMethod('hello');
    const rejection = expect(promise).rejects.toThrow("Request 'testMethod' timed out after 100ms");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await rejection;
  });

  it('should not time out when requestTimeoutMs is 0', async () => {
    const api = renderProvider(0);

    let settled = false;
    const promise = api.testMethod('hello');
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 10);
    });

    expect(settled).toBe(false);
  });

  it('should resolve normally and not fire the timeout when a response arrives', async () => {
    const api = renderProvider();

    const promise = api.testMethod('hello');
    const request = lastPostedRequest();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'response', id: request.id, value: 'result' },
        })
      );
    });

    await expect(promise).resolves.toBe('result');

    // Advancing past the timeout must not produce a late rejection
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 2);
    });
  });

  it('should reject with the host error and not fire the timeout when an error arrives', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const api = renderProvider();

    const promise = api.testMethod('hello');
    const request = lastPostedRequest();
    const rejection = expect(promise).rejects.toThrow('host failed');

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'error', id: request.id, value: 'host failed' },
        })
      );
    });

    await rejection;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 2);
    });
    consoleSpy.mockRestore();
  });
});

describe('WebviewProvider unrecognized message handling', () => {
  it('should log unrecognized window messages at debug level, not error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    renderProvider();

    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: { source: 'some-other-script' } }));
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      'Received unrecognized message format:',
      expect.objectContaining({ source: 'some-other-script' })
    );

    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
