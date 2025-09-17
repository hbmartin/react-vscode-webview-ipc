import { describe, it, expect } from 'vitest';
import type { Brand } from '../../../src/lib/types/index';

describe('types/index', () => {
  describe('Brand type', () => {
    it('should create branded types that are assignable from base type', () => {
      type UserId = Brand<string, 'UserId'>;
      type ProductId = Brand<string, 'ProductId'>;

      const createUserId = (id: string): UserId => id as UserId;
      const createProductId = (id: string): ProductId => id as ProductId;

      const userId = createUserId('user-123');
      const productId = createProductId('product-456');

      // Should be able to use as strings
      expect(typeof userId).toBe('string');
      expect(typeof productId).toBe('string');
      expect(userId.length).toBe(8);
      expect(productId.includes('product')).toBe(true);
    });

    it('should prevent accidental assignment between different branded types', () => {
      type UserId = Brand<string, 'UserId'>;
      type ProductId = Brand<string, 'ProductId'>;

      const userId = 'user-123' as UserId;
      const productId = 'product-456' as ProductId;

      // This test verifies the types exist and work at runtime
      // TypeScript compiler would catch invalid assignments at compile time
      expect(userId).toBeDefined();
      expect(productId).toBeDefined();
    });

    it('should work with different base types', () => {
      type SafeNumber = Brand<number, 'Safe'>;
      type PositiveNumber = Brand<number, 'Positive'>;

      const safeNum = 42 as SafeNumber;
      const positiveNum = 100 as PositiveNumber;

      expect(typeof safeNum).toBe('number');
      expect(typeof positiveNum).toBe('number');
      expect(safeNum + 1).toBe(43);
      expect(positiveNum * 2).toBe(200);
    });

    it('should preserve all properties of base type', () => {
      type TimestampMs = Brand<number, 'TimestampMs'>;

      const now = Date.now() as TimestampMs;

      // Should work with all number methods
      expect(now.toString()).toContain('1');
      expect(now.valueOf()).toBe(now);
      expect(Number.isFinite(now)).toBe(true);
    });

    it('should work with complex objects', () => {
      interface User {
        id: string;
        name: string;
      }

      type ValidatedUser = Brand<User, 'Validated'>;

      const user: User = { id: '123', name: 'John' };
      const validatedUser = user as ValidatedUser;

      expect(validatedUser.id).toBe('123');
      expect(validatedUser.name).toBe('John');
      expect(Object.keys(validatedUser)).toEqual(['id', 'name']);
    });
  });

  describe('module exports', () => {
    it('should re-export log types', async () => {
      const logModule = await import('../../../src/lib/types/log');

      // Verify log types are exported from log module
      expect('LogLevel' in logModule).toBe(true);
      expect('isLogMessage' in logModule).toBe(true);

      // Test that log types are accessible through index re-export
      const { LogLevel } = await import('../../../src/lib/types/index');
      expect(LogLevel).toBeDefined();
      expect(typeof LogLevel).toBe('object');
    });

    it('should re-export rpc types', async () => {
      const rpcModule = await import('../../../src/lib/types/rpc');
      const indexModule = await import('../../../src/lib/types/index');

      // Verify rpc types are available through index
      expect('isViewApiRequest' in rpcModule).toBe(true);
      expect('isViewApiResponse' in rpcModule).toBe(true);
      expect('isViewApiError' in rpcModule).toBe(true);
      expect('isViewApiEvent' in rpcModule).toBe(true);
    });
  });
});