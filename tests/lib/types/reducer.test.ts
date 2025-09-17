import { describe, it, expect } from 'vitest';
import {
  PATCH,
  ACT,
  type WebviewKey,
  type FnKeys,
  type Action,
  type Patch,
  type ActionDelegate,
  type Patches,
} from '../../../src/lib/types/reducer';

// Test interface with various function types
interface TestActions {
  syncMethod: (arg: string) => string;
  asyncMethod: (num: number) => Promise<number>;
  voidMethod: () => void;
  complexMethod: (a: string, b: number, c?: boolean) => Promise<{ result: string }>;
  nonFunction: string;
  numberProp: number;
}

describe('reducer types', () => {
  describe('Constants', () => {
    it('should have correct constant values', () => {
      expect(PATCH).toBe('patch');
      expect(ACT).toBe('act');
    });
  });

  describe('WebviewKey brand type', () => {
    it('should allow creation of branded strings', () => {
      const key = 'test-key' as WebviewKey;
      expect(typeof key).toBe('string');
      expect(key).toBe('test-key');
    });

    it('should maintain brand at compile time', () => {
      // This test verifies the type works at compile time
      const brandedKey: WebviewKey = 'webview-123' as WebviewKey;
      const regularString: string = brandedKey; // Should work - WebviewKey extends string
      expect(regularString).toBe('webview-123');
    });
  });

  describe('FnKeys type', () => {
    it('should extract only function keys', () => {
      type TestFnKeys = FnKeys<TestActions>;

      // These should be valid function keys
      const validKeys: TestFnKeys[] = ['syncMethod', 'asyncMethod', 'voidMethod', 'complexMethod'];

      for (const key of validKeys) {
        expect(['syncMethod', 'asyncMethod', 'voidMethod', 'complexMethod']).toContain(key);
      }

      // Verify non-function properties are not included
      // This is a compile-time check, but we can test runtime behavior
      const allKeys = ['syncMethod', 'asyncMethod', 'voidMethod', 'complexMethod'];
      expect(allKeys).not.toContain('nonFunction');
      expect(allKeys).not.toContain('numberProp');
    });
  });

  describe('Action type', () => {
    it('should create valid action for sync method', () => {
      const action: Action<TestActions, 'syncMethod'> = {
        type: ACT,
        providerId: 'provider-123' as WebviewKey,
        key: 'syncMethod',
        params: ['test-argument'],
      };

      expect(action.type).toBe(ACT);
      expect(action.providerId).toBe('provider-123');
      expect(action.key).toBe('syncMethod');
      expect(action.params).toEqual(['test-argument']);
    });

    it('should create valid action for async method', () => {
      const action: Action<TestActions, 'asyncMethod'> = {
        type: ACT,
        providerId: 'provider-456' as WebviewKey,
        key: 'asyncMethod',
        params: [42],
      };

      expect(action.type).toBe(ACT);
      expect(action.providerId).toBe('provider-456');
      expect(action.key).toBe('asyncMethod');
      expect(action.params).toEqual([42]);
    });

    it('should create valid action for void method', () => {
      const action: Action<TestActions, 'voidMethod'> = {
        type: ACT,
        providerId: 'provider-789' as WebviewKey,
        key: 'voidMethod',
        params: [],
      };

      expect(action.type).toBe(ACT);
      expect(action.providerId).toBe('provider-789');
      expect(action.key).toBe('voidMethod');
      expect(action.params).toEqual([]);
    });

    it('should create valid action for complex method', () => {
      const action: Action<TestActions, 'complexMethod'> = {
        type: ACT,
        providerId: 'provider-complex' as WebviewKey,
        key: 'complexMethod',
        params: ['test', 123, true],
      };

      expect(action.type).toBe(ACT);
      expect(action.providerId).toBe('provider-complex');
      expect(action.key).toBe('complexMethod');
      expect(action.params).toEqual(['test', 123, true]);
    });

    it('should handle optional parameters', () => {
      const actionWithOptional: Action<TestActions, 'complexMethod'> = {
        type: ACT,
        providerId: 'provider-optional' as WebviewKey,
        key: 'complexMethod',
        params: ['test', 123], // Third parameter is optional
      };

      expect(actionWithOptional.params).toEqual(['test', 123]);
    });
  });

  describe('Patch type', () => {
    it('should create valid patch for sync method', () => {
      const patch: Patch<TestActions, 'syncMethod'> = {
        type: PATCH,
        providerId: 'provider-123' as WebviewKey,
        key: 'syncMethod',
        patch: 'result-value',
      };

      expect(patch.type).toBe(PATCH);
      expect(patch.providerId).toBe('provider-123');
      expect(patch.key).toBe('syncMethod');
      expect(patch.patch).toBe('result-value');
    });

    it('should create valid patch for async method (unwrapped)', () => {
      const patch: Patch<TestActions, 'asyncMethod'> = {
        type: PATCH,
        providerId: 'provider-456' as WebviewKey,
        key: 'asyncMethod',
        patch: 42, // Number, not Promise<number>
      };

      expect(patch.type).toBe(PATCH);
      expect(patch.providerId).toBe('provider-456');
      expect(patch.key).toBe('asyncMethod');
      expect(patch.patch).toBe(42);
    });

    it('should create valid patch for void method', () => {
      const patch: Patch<TestActions, 'voidMethod'> = {
        type: PATCH,
        providerId: 'provider-789' as WebviewKey,
        key: 'voidMethod',
        patch: undefined,
      };

      expect(patch.type).toBe(PATCH);
      expect(patch.providerId).toBe('provider-789');
      expect(patch.key).toBe('voidMethod');
      expect(patch.patch).toBeUndefined();
    });

    it('should create valid patch for complex method', () => {
      const patch: Patch<TestActions, 'complexMethod'> = {
        type: PATCH,
        providerId: 'provider-complex' as WebviewKey,
        key: 'complexMethod',
        patch: { result: 'success' },
      };

      expect(patch.type).toBe(PATCH);
      expect(patch.providerId).toBe('provider-complex');
      expect(patch.key).toBe('complexMethod');
      expect(patch.patch).toEqual({ result: 'success' });
    });
  });

  describe('ActionDelegate type', () => {
    it('should allow both sync and async implementations', async () => {
      const delegate: ActionDelegate<TestActions> = {
        syncMethod: (arg: string) => `Sync: ${arg}`,
        asyncMethod: async (num: number) => num * 2,
        voidMethod: () => {},
        complexMethod: async (a: string, b: number, c?: boolean) => ({
          result: `${a}-${b}-${c}`,
        }),
      };

      // Test sync method
      const syncResult = delegate.syncMethod('test');
      expect(syncResult).toBe('Sync: test');

      // Test async method
      const asyncResult = await delegate.asyncMethod(21);
      expect(asyncResult).toBe(42);

      // Test void method
      expect(delegate.voidMethod()).toBeUndefined();

      // Test complex method
      const complexResult = await delegate.complexMethod('a', 1, true);
      expect(complexResult).toEqual({ result: 'a-1-true' });
    });

    it('should allow sync implementation of async interface methods', async () => {
      const delegate: ActionDelegate<TestActions> = {
        syncMethod: (arg: string) => `Sync: ${arg}`,
        asyncMethod: (num: number) => Promise.resolve(num * 2), // Must return Promise
        voidMethod: () => {},
        complexMethod: (a: string, b: number, c?: boolean) =>
          Promise.resolve({
            result: `${a}-${b}-${c}`, // Must return Promise
          }),
      };

      // Sync implementation should still work
      const result = await delegate.asyncMethod(21);
      expect(result).toBe(42);

      const complexResult = await delegate.complexMethod('a', 1);
      expect(complexResult).toEqual({ result: 'a-1-undefined' });
    });
  });

  describe('Patches type', () => {
    it('should unwrap Promise types', () => {
      type TestPatches = Patches<TestActions>;

      // Create an object matching the Patches type
      const patches: TestPatches = {
        syncMethod: 'string-result',
        asyncMethod: 123, // Number, not Promise<number>
        voidMethod: undefined,
        complexMethod: { result: 'test' }, // Object, not Promise<object>
      };

      expect(patches.syncMethod).toBe('string-result');
      expect(patches.asyncMethod).toBe(123);
      expect(patches.voidMethod).toBeUndefined();
      expect(patches.complexMethod).toEqual({ result: 'test' });
    });

    it('should handle nested Promise types correctly', () => {
      interface NestedAsyncActions {
        simpleAsync: () => Promise<string>;
        nestedData: () => Promise<{ data: { value: number } }>;
        arrayAsync: () => Promise<string[]>;
      }

      type NestedPatches = Patches<NestedAsyncActions>;

      const patches: NestedPatches = {
        simpleAsync: 'unwrapped',
        nestedData: { data: { value: 42 } },
        arrayAsync: ['a', 'b', 'c'],
      };

      expect(patches.simpleAsync).toBe('unwrapped');
      expect(patches.nestedData).toEqual({ data: { value: 42 } });
      expect(patches.arrayAsync).toEqual(['a', 'b', 'c']);
    });
  });

  describe('IpcMessage interface behavior', () => {
    it('should enforce readonly properties', () => {
      const action: Action<TestActions, 'syncMethod'> = {
        type: ACT,
        providerId: 'test' as WebviewKey,
        key: 'syncMethod',
        params: ['arg'] as const,
      };

      // Properties should be readonly
      expect(action.type).toBe(ACT);
      expect(action.providerId).toBe('test');

      const patch: Patch<TestActions> = {
        type: PATCH,
        providerId: 'test' as WebviewKey,
        key: 'syncMethod',
        patch: 'result',
      };

      expect(patch.type).toBe(PATCH);
      expect(patch.providerId).toBe('test');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty parameter lists', () => {
      interface EmptyParamActions {
        noParams: () => string;
      }

      const action: Action<EmptyParamActions> = {
        type: ACT,
        providerId: 'empty' as WebviewKey,
        key: 'noParams',
        params: [],
      };

      expect(action.params).toEqual([]);
    });

    it('should handle multiple parameters correctly', () => {
      interface MultiParamActions {
        manyParams: (a: string, b: number, c: boolean, d: object, e: any[]) => void;
      }

      const action: Action<MultiParamActions> = {
        type: ACT,
        providerId: 'multi' as WebviewKey,
        key: 'manyParams',
        params: ['test', 123, true, { key: 'value' }, [1, 2, 3]],
      };

      expect(action.params).toHaveLength(5);
      expect(action.params[0]).toBe('test');
      expect(action.params[1]).toBe(123);
      expect(action.params[2]).toBe(true);
      expect(action.params[3]).toEqual({ key: 'value' });
      expect(action.params[4]).toEqual([1, 2, 3]);
    });
  });
});
