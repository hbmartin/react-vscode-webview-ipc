import { describe, it, expect } from 'vitest';

describe('host module exports', () => {
  it('should export Logger, getLogger, and disallowedLogKeys', async () => {
    const { Logger, getLogger, disallowedLogKeys } = await import('../../src/lib/host');

    expect(Logger).toBeDefined();
    expect(getLogger).toBeDefined();
    expect(disallowedLogKeys).toBeDefined();

    expect(typeof Logger).toBe('object');
    expect(typeof getLogger).toBe('function');
    expect(Array.isArray(disallowedLogKeys)).toBe(true);
  });

  it('should export WebviewApiProvider', async () => {
    const { WebviewApiProvider } = await import('../../src/lib/host');
    expect(WebviewApiProvider).toBeDefined();
    expect(typeof WebviewApiProvider).toBe('function');
  });

  it('should export BaseWebviewViewProvider', async () => {
    const { BaseWebviewViewProvider } = await import('../../src/lib/host');
    expect(BaseWebviewViewProvider).toBeDefined();
    expect(typeof BaseWebviewViewProvider).toBe('function');
  });

  it('should export isViewApiRequest', async () => {
    const { isViewApiRequest } = await import('../../src/lib/host');
    expect(isViewApiRequest).toBeDefined();
    expect(typeof isViewApiRequest).toBe('function');
  });

  it('should export type definitions', async () => {
    // TypeScript types are erased at runtime, but we can test that imports work
    const module = await import('../../src/lib/host');

    // Test that module loads without error
    expect(module).toBeDefined();
    expect(typeof module).toBe('object');
  });

  describe('integration with actual exports', () => {
    it('should have working getLogger function', async () => {
      const { getLogger } = await import('../../src/lib/host');

      const logger = getLogger('test-logger');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have disallowedLogKeys array with expected values', async () => {
      const { disallowedLogKeys } = await import('../../src/lib/host');

      expect(disallowedLogKeys.length).toBeGreaterThan(0);
      expect(disallowedLogKeys).toContain('password');
      expect(disallowedLogKeys).toContain('token');
      expect(disallowedLogKeys).toContain('secret');
    });

    it('should have working isViewApiRequest function', async () => {
      const { isViewApiRequest } = await import('../../src/lib/host');

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

    it('should have Logger object with methods', async () => {
      const { Logger } = await import('../../src/lib/host');

      expect(Logger).toBeDefined();
      expect(typeof Logger.info).toBe('function');
      expect(typeof Logger.warn).toBe('function');
      expect(typeof Logger.error).toBe('function');
      expect(typeof Logger.debug).toBe('function');
      expect(typeof Logger.dispose).toBe('function');
    });
  });

  describe('module structure', () => {
    it('should only export expected members', async () => {
      const module = await import('../../src/lib/host');
      const exports = Object.keys(module);

      const expectedExports = [
        'Logger',
        'getLogger',
        'disallowedLogKeys',
        'WebviewApiProvider',
        'BaseWebviewViewProvider',
        'isViewApiRequest',
      ];

      expectedExports.forEach((exportName) => {
        expect(exports).toContain(exportName);
      });
    });

    it('should not have unexpected exports', async () => {
      const module = await import('../../src/lib/host');
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
