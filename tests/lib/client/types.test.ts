import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DeferredPromise,
  type WebviewLayout,
  type VsCodeApi,
  type StateReducer,
} from '../../../src/lib/client/types';

describe('client types', () => {
  describe('DeferredPromise', () => {
    let deferred: DeferredPromise<string>;

    beforeEach(() => {
      deferred = new DeferredPromise<string>('test-key');
    });

    afterEach(() => {
      deferred.clearTimeout();
    });

    it('should create deferred promise with key', () => {
      expect(deferred.key).toBe('test-key');
      expect(deferred.promise).toBeInstanceOf(Promise);
      expect(typeof deferred.resolve).toBe('function');
      expect(typeof deferred.reject).toBe('function');
    });

    it('should resolve promise when resolve is called', async () => {
      const testValue = 'resolved value';

      // Resolve the promise
      deferred.resolve(testValue);

      // Await the result
      const result = await deferred.promise;
      expect(result).toBe(testValue);
    });

    it('should reject promise when reject is called', async () => {
      const testError = new Error('test error');

      // Reject the promise
      deferred.reject(testError);

      // Expect the promise to reject
      await expect(deferred.promise).rejects.toThrow('test error');
    });

    it('should only resolve once when called multiple times', async () => {
      const firstValue = 'first';
      const secondValue = 'second';

      deferred.resolve(firstValue);
      deferred.resolve(secondValue); // Should be ignored

      const result = await deferred.promise;
      expect(result).toBe(firstValue);
    });

    it('should only reject once when called multiple times', async () => {
      const firstError = new Error('first error');
      const secondError = new Error('second error');

      deferred.reject(firstError);
      deferred.reject(secondError); // Should be ignored

      await expect(deferred.promise).rejects.toThrow('first error');
    });

    it('should ignore resolve after reject', async () => {
      const error = new Error('test error');
      const value = 'test value';

      deferred.reject(error);
      deferred.resolve(value); // Should be ignored

      await expect(deferred.promise).rejects.toThrow('test error');
    });

    it('should ignore reject after resolve', async () => {
      const value = 'test value';
      const error = new Error('test error');

      deferred.resolve(value);
      deferred.reject(error); // Should be ignored

      const result = await deferred.promise;
      expect(result).toBe(value);
    });

    it('should convert non-Error rejections to Error instances', async () => {
      const stringError = 'string error';

      deferred.reject(stringError);

      await expect(deferred.promise).rejects.toThrow('string error');
    });

    it('should handle undefined rejection', async () => {
      deferred.reject(undefined);

      await expect(deferred.promise).rejects.toThrow('undefined');
    });

    it('should handle null rejection', async () => {
      deferred.reject(null);

      await expect(deferred.promise).rejects.toThrow('null');
    });

    describe('timeout management', () => {
      it('should store timeout handle', () => {
        const timeoutId = setTimeout(() => {}, 1000);
        deferred.timeoutHandle = timeoutId;

        expect(deferred.timeoutHandle).toBe(timeoutId);

        clearTimeout(timeoutId);
      });

      it('should clear timeout handle', () => {
        const timeoutId = setTimeout(() => {}, 1000);
        deferred.timeoutHandle = timeoutId;

        deferred.clearTimeout();

        expect(deferred.timeoutHandle).toBeUndefined();
      });

      it('should handle clearTimeout when no timeout is set', () => {
        expect(() => deferred.clearTimeout()).not.toThrow();
        expect(deferred.timeoutHandle).toBeUndefined();
      });

      it('should clear timeout multiple times without error', () => {
        const timeoutId = setTimeout(() => {}, 1000);
        deferred.timeoutHandle = timeoutId;

        deferred.clearTimeout();
        deferred.clearTimeout(); // Should not throw

        expect(deferred.timeoutHandle).toBeUndefined();
      });
    });

    describe('markSettled', () => {
      it('should prevent future resolve calls', async () => {
        deferred.markSettled();
        deferred.resolve('test');

        // Promise should remain pending
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10)
        );

        await expect(Promise.race([deferred.promise, timeoutPromise])).rejects.toThrow('timeout');
      });

      it('should prevent future reject calls', async () => {
        deferred.markSettled();
        deferred.reject(new Error('test'));

        // Promise should remain pending
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10)
        );

        await expect(Promise.race([deferred.promise, timeoutPromise])).rejects.toThrow('timeout');
      });
    });
  });

  describe('WebviewLayout type', () => {
    it('should accept valid layout values', () => {
      const sidebarLayout: WebviewLayout = 'sidebar';
      const panelLayout: WebviewLayout = 'panel';

      expect(sidebarLayout).toBe('sidebar');
      expect(panelLayout).toBe('panel');
    });
  });

  describe('VsCodeApi interface', () => {
    let mockVsCodeApi: VsCodeApi;

    beforeEach(() => {
      mockVsCodeApi = {
        postMessage: vi.fn().mockResolvedValue(true),
        getState: vi.fn().mockReturnValue(null),
        setState: vi.fn(),
      };
    });

    it('should implement postMessage method', async () => {
      const message = { type: 'test', data: 'value' };
      const result = await mockVsCodeApi.postMessage(message);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith(message);
      expect(result).toBe(true);
    });

    it('should implement getState method', () => {
      const testState = { key: 'value' };
      mockVsCodeApi.getState = vi.fn().mockReturnValue(testState);

      const result = mockVsCodeApi.getState();

      expect(mockVsCodeApi.getState).toHaveBeenCalled();
      expect(result).toBe(testState);
    });

    it('should implement setState method', () => {
      const testState = { key: 'value' };

      mockVsCodeApi.setState(testState);

      expect(mockVsCodeApi.setState).toHaveBeenCalledWith(testState);
    });

    it('should handle postMessage with different data types', async () => {
      await mockVsCodeApi.postMessage('string');
      await mockVsCodeApi.postMessage(123);
      await mockVsCodeApi.postMessage({ complex: { object: true } });
      await mockVsCodeApi.postMessage([1, 2, 3]);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledTimes(4);
    });
  });

  describe('StateReducer type', () => {
    interface TestState {
      count: number;
      name: string;
    }

    interface TestActions {
      increment: (amount: number) => void;
      setName: (name: string) => void;
      reset: () => void;
    }

    it('should type state reducer correctly', () => {
      const reducer: StateReducer<TestState, TestActions> = {
        increment: (prevState, amount) => ({
          ...prevState,
          count: prevState.count + amount,
        }),
        setName: (prevState, name) => ({
          ...prevState,
          name,
        }),
        reset: () => ({
          count: 0,
          name: '',
        }),
      };

      const initialState: TestState = { count: 5, name: 'test' };

      // Test increment
      const incrementedState = reducer.increment(initialState, 3);
      expect(incrementedState.count).toBe(8);
      expect(incrementedState.name).toBe('test');

      // Test setName
      const namedState = reducer.setName(initialState, 'new name');
      expect(namedState.count).toBe(5);
      expect(namedState.name).toBe('new name');

      // Test reset
      const resetState = reducer.reset(initialState);
      expect(resetState.count).toBe(0);
      expect(resetState.name).toBe('');
    });

    it('should preserve original state immutability', () => {
      const reducer: StateReducer<TestState, TestActions> = {
        increment: (prevState, amount) => ({
          ...prevState,
          count: prevState.count + amount,
        }),
        setName: (prevState, name) => ({
          ...prevState,
          name,
        }),
        reset: () => ({
          count: 0,
          name: '',
        }),
      };

      const originalState: TestState = { count: 10, name: 'original' };
      const newState = reducer.increment(originalState, 5);

      // Original state should be unchanged
      expect(originalState.count).toBe(10);
      expect(originalState.name).toBe('original');

      // New state should have changes
      expect(newState.count).toBe(15);
      expect(newState.name).toBe('original');
    });
  });
});
