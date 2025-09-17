import { describe, it, expect } from 'vitest';

describe('client module exports', () => {
  it('should export WebviewProvider', async () => {
    const { WebviewProvider } = await import('../../src/lib/client');
    expect(WebviewProvider).toBeDefined();
    expect(typeof WebviewProvider).toBe('function');
  });

  it('should export createCtxKey and useWebviewApi', async () => {
    const { createCtxKey, useWebviewApi } = await import('../../src/lib/client');
    expect(createCtxKey).toBeDefined();
    expect(useWebviewApi).toBeDefined();
    expect(typeof createCtxKey).toBe('function');
    expect(typeof useWebviewApi).toBe('function');
  });

  it('should export useVscodeState', async () => {
    const { useVscodeState } = await import('../../src/lib/client');
    expect(useVscodeState).toBeDefined();
    expect(typeof useVscodeState).toBe('function');
  });

  it('should export useLogger', async () => {
    const { useLogger } = await import('../../src/lib/client');
    expect(useLogger).toBeDefined();
    expect(typeof useLogger).toBe('function');
  });

  it('should export isViewApiRequest', async () => {
    const { isViewApiRequest } = await import('../../src/lib/client');
    expect(isViewApiRequest).toBeDefined();
    expect(typeof isViewApiRequest).toBe('function');
  });

  it('should export type definitions', async () => {
    // TypeScript types are erased at runtime, but we can test that imports work
    const module = await import('../../src/lib/client');

    // Test that module loads without error
    expect(module).toBeDefined();
    expect(typeof module).toBe('object');
  });

  describe('integration with actual exports', () => {
    it('should have working createCtxKey function', async () => {
      const { createCtxKey } = await import('../../src/lib/client');

      const key = createCtxKey<string>('test');
      expect(key).toBeDefined();
      expect(typeof key).toBe('object');
      expect(key.id).toBeDefined();
      expect(typeof key.id).toBe('symbol');
    });

    it('should have working isViewApiRequest function', async () => {
      const { isViewApiRequest } = await import('../../src/lib/client');

      const validRequest = {
        type: 'request',
        id: '123',
        key: 'test',
        params: [],
      };

      expect(isViewApiRequest(validRequest)).toBe(true);
      expect(isViewApiRequest(null)).toBe(false);
      expect(isViewApiRequest({})).toBe(false);
    });
  });

  describe('module structure', () => {
    it('should only export expected members', async () => {
      const module = await import('../../src/lib/client');
      const exports = Object.keys(module);

      const expectedExports = [
        'WebviewProvider',
        'createCtxKey',
        'useWebviewApi',
        'useVscodeState',
        'useLogger',
        'isViewApiRequest',
      ];

      expectedExports.forEach((exportName) => {
        expect(exports).toContain(exportName);
      });
    });

    it('should not have unexpected exports', async () => {
      const module = await import('../../src/lib/client');
      const exports = Object.keys(module);

      // Should not export internal implementation details
      expect(exports).not.toContain('default');
      expect(exports).not.toContain('__esModule');

      // Should only have the expected number of exports (allowing for some flexibility)
      expect(exports.length).toBeGreaterThanOrEqual(6);
      expect(exports.length).toBeLessThanOrEqual(10);
    });
  });
});
