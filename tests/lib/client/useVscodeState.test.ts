import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVscodeState } from '../../../src/lib/client/useVscodeState';
import { PATCH, ACT, type WebviewKey } from '../../../src/lib/types/reducer';
import type { StateReducer, VsCodeApi } from '../../../src/lib/client/types';

// Test interfaces
interface TestState {
  count: number;
  text: string;
}

interface TestActions {
  increment: () => void;
  decrement: () => void;
  setText: (text: string) => void;
  multiplyBy: (factor: number) => void;
}

describe('useVscodeState', () => {
  let mockVscode: VsCodeApi;
  let providerId: WebviewKey;
  let postReducer: StateReducer<TestState, TestActions>;
  let initialState: TestState;
  let messageListeners: ((event: MessageEvent) => void)[] = [];

  beforeEach(() => {
    // Clear message listeners
    messageListeners = [];

    // Mock VS Code API
    mockVscode = {
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    };

    // Setup test data
    providerId = 'test.provider' as WebviewKey;
    initialState = { count: 0, text: 'initial' };

    // Setup post reducer
    postReducer = {
      increment: (state, _patch) => ({ ...state, count: state.count + 1 }),
      decrement: (state, _patch) => ({ ...state, count: state.count - 1 }),
      setText: (state, patch) => ({ ...state, text: patch as unknown as string }),
      multiplyBy: (state, patch) => ({
        ...state,
        count: state.count * (patch as unknown as number),
      }),
    };

    // Mock window.addEventListener and removeEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'message') {
        messageListeners.push(listener as (event: MessageEvent) => void);
      }
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((event, listener) => {
      if (event === 'message') {
        const index = messageListeners.indexOf(listener as (event: MessageEvent) => void);
        if (index > -1) {
          messageListeners.splice(index, 1);
        }
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    messageListeners = [];
  });

  describe('initialization', () => {
    it('should initialize with initial state object', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const [state] = result.current;
      expect(state).toEqual({ count: 0, text: 'initial' });
    });

    it('should initialize with initial state function', () => {
      const initFn = () => ({ count: 10, text: 'from function' });
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initFn)
      );

      const [state] = result.current;
      expect(state).toEqual({ count: 10, text: 'from function' });
    });

    it('should setup message listener on mount', () => {
      renderHook(() => useVscodeState(mockVscode, providerId, postReducer, initialState));

      expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(messageListeners).toHaveLength(1);
    });

    it('should cleanup message listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      expect(messageListeners).toHaveLength(1);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('actions', () => {
    it('should call postMessage when action is invoked', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const [, actions] = result.current;

      act(() => {
        actions.increment();
      });

      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: ACT,
        providerId: 'test.provider',
        key: 'increment',
        params: [],
      });
    });

    it('should pass parameters correctly', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const [, actions] = result.current;

      act(() => {
        actions.setText('new text');
      });

      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: ACT,
        providerId: 'test.provider',
        key: 'setText',
        params: ['new text'],
      });

      act(() => {
        actions.multiplyBy(3);
      });

      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: ACT,
        providerId: 'test.provider',
        key: 'multiplyBy',
        params: [3],
      });
    });

    it('should throw error for unknown action', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const [, actions] = result.current;

      expect(() => {
        (actions as any).unknownAction();
      }).toThrow('Unknown or invalid action: unknownAction');
    });

    it('should throw error for dangerous action keys', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const [, actions] = result.current;

      expect(() => {
        (actions as any).__proto__();
      }).toThrow('Dangerous action key is blocked: __proto__');

      expect(() => {
        (actions as any).constructor();
      }).toThrow('Dangerous action key is blocked: constructor');

      expect(() => {
        (actions as any).prototype();
      }).toThrow('Dangerous action key is blocked: prototype');
    });

    it('should throw error when vscode api is undefined', () => {
      const { result } = renderHook(() =>
        useVscodeState(undefined as any, providerId, postReducer, initialState)
      );

      const [, actions] = result.current;

      expect(() => {
        actions.increment();
      }).toThrow('Vscode api is undefined');
    });
  });

  describe('message handling', () => {
    it('should update state when patch message is received', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const patchMessage = {
        type: PATCH,
        providerId: 'test.provider',
        key: 'increment',
        patch: undefined,
      };

      act(() => {
        messageListeners[0](new MessageEvent('message', { data: patchMessage }));
      });

      const [state] = result.current;
      expect(state.count).toBe(1);
    });

    it('should apply patch data correctly', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const patchMessage = {
        type: PATCH,
        providerId: 'test.provider',
        key: 'setText',
        patch: 'updated text',
      };

      act(() => {
        messageListeners[0](new MessageEvent('message', { data: patchMessage }));
      });

      const [state] = result.current;
      expect(state.text).toBe('updated text');
    });

    it('should ignore messages with wrong provider ID', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const patchMessage = {
        type: PATCH,
        providerId: 'different.provider',
        key: 'increment',
        patch: undefined,
      };

      act(() => {
        messageListeners[0](new MessageEvent('message', { data: patchMessage }));
      });

      const [state] = result.current;
      expect(state.count).toBe(0); // Should not change
    });

    it('should ignore non-patch messages', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const nonPatchMessage = {
        type: 'other',
        providerId: 'test.provider',
        key: 'increment',
        patch: undefined,
      };

      act(() => {
        messageListeners[0](new MessageEvent('message', { data: nonPatchMessage }));
      });

      const [state] = result.current;
      expect(state.count).toBe(0); // Should not change
    });

    it('should throw error for unknown reducer key in patch', () => {
      renderHook(() => useVscodeState(mockVscode, providerId, postReducer, initialState));

      const patchMessage = {
        type: PATCH,
        providerId: 'test.provider',
        key: 'unknownKey',
        patch: undefined,
      };

      expect(() => {
        act(() => {
          messageListeners[0](new MessageEvent('message', { data: patchMessage }));
        });
      }).toThrow('Could not find a function for unknownKey in postReducer');
    });

    it('should handle multiple patch messages', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      act(() => {
        messageListeners[0](
          new MessageEvent('message', {
            data: {
              type: PATCH,
              providerId: 'test.provider',
              key: 'increment',
              patch: undefined,
            },
          })
        );
      });

      act(() => {
        messageListeners[0](
          new MessageEvent('message', {
            data: {
              type: PATCH,
              providerId: 'test.provider',
              key: 'multiplyBy',
              patch: 3,
            },
          })
        );
      });

      act(() => {
        messageListeners[0](
          new MessageEvent('message', {
            data: {
              type: PATCH,
              providerId: 'test.provider',
              key: 'setText',
              patch: 'final text',
            },
          })
        );
      });

      const [state] = result.current;
      expect(state.count).toBe(3); // (0 + 1) * 3
      expect(state.text).toBe('final text');
    });
  });

  describe('edge cases', () => {
    it('should handle invalid action types', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      const [, actions] = result.current;

      expect(() => {
        (actions as any)[123]();
      }).toThrow('Unknown or invalid action: 123');

      expect(() => {
        const actionsObj = actions as any;
        const nullKey = null as any;
        actionsObj[nullKey]();
      }).toThrow('Unknown or invalid action: null');
    });

    it('should handle reducer with no functions', () => {
      const emptyReducer = {} as StateReducer<TestState, TestActions>;
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, emptyReducer, initialState)
      );

      const [, actions] = result.current;

      expect(() => {
        actions.increment();
      }).toThrow('Unknown or invalid action: increment');
    });

    it('should handle malformed patch messages', () => {
      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      // Missing fields
      act(() => {
        messageListeners[0](new MessageEvent('message', { data: {} }));
      });

      // Null data
      act(() => {
        messageListeners[0](new MessageEvent('message', { data: null }));
      });

      // Wrong structure
      act(() => {
        messageListeners[0](
          new MessageEvent('message', {
            data: { type: PATCH, wrongField: 'value' },
          })
        );
      });

      const [state] = result.current;
      expect(state).toEqual(initialState); // Should not change
    });

    it('should handle symbol keys in actions', () => {
      const symbolKey = Symbol('symbolAction');
      const reducerWithSymbol = {
        ...postReducer,
        [symbolKey]: (state: TestState) => ({ ...state, count: 999 }),
      };

      const { result } = renderHook(() =>
        useVscodeState(mockVscode, providerId, reducerWithSymbol, initialState)
      );

      const [, actions] = result.current;

      // Symbol keys should work in proxy
      expect(() => {
        (actions as any)[symbolKey]();
      }).not.toThrow();

      expect(mockVscode.postMessage).toHaveBeenCalledWith({
        type: ACT,
        providerId: 'test.provider',
        key: symbolKey,
        params: [],
      });
    });
  });

  describe('re-rendering behavior', () => {
    it('should maintain state across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        useVscodeState(mockVscode, providerId, postReducer, initialState)
      );

      // Update state
      act(() => {
        messageListeners[0](
          new MessageEvent('message', {
            data: {
              type: PATCH,
              providerId: 'test.provider',
              key: 'setText',
              patch: 'updated',
            },
          })
        );
      });

      const [stateBefore] = result.current;
      expect(stateBefore.text).toBe('updated');

      // Re-render
      rerender();

      const [stateAfter] = result.current;
      expect(stateAfter.text).toBe('updated');
    });

    it('should update actions when reducer changes', () => {
      const { result, rerender } = renderHook(
        ({ reducer }) => useVscodeState(mockVscode, providerId, reducer, initialState),
        { initialProps: { reducer: postReducer } }
      );

      const newReducer = {
        ...postReducer,
        newAction: (state: TestState) => ({ ...state, count: 100 }),
      };

      rerender({ reducer: newReducer });

      const [, actions] = result.current;

      // New action should be available
      expect(() => {
        (actions as any).newAction();
      }).not.toThrow();
    });
  });
});
