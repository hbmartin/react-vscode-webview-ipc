import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateId, getErrorMessage } from '../../../src/lib/utils';

describe('utils', () => {
  describe('generateId', () => {
    let originalDateNow: typeof Date.now;
    let originalMathRandom: typeof Math.random;

    beforeEach(() => {
      // Save original functions
      originalDateNow = Date.now;
      originalMathRandom = Math.random;
    });

    afterEach(() => {
      // Restore original functions
      Date.now = originalDateNow;
      Math.random = originalMathRandom;
    });

    it('should generate unique ID with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_\d+_[\da-z]{9}$/);
    });

    it('should include timestamp in ID', () => {
      const mockTime = 1_234_567_890;
      Date.now = vi.fn(() => mockTime);

      const id = generateId('prefix');
      expect(id).toContain('1234567890');
      expect(id).toMatch(/^prefix_1234567890_[\da-z]{9}$/);
    });

    it('should include random component', () => {
      Math.random = vi.fn(() => 0.5);

      const id = generateId('test');
      // Math.random() returns 0.5, toString(36) gives 'i', slice(2,11) gives up to 9 chars
      expect(id).toMatch(/^test_\d+_/);
      // The random component should be at least 1 character
      expect(id.split('_')[2].length).toBeGreaterThan(0);
    });

    it('should generate different IDs for same prefix', () => {
      const id1 = generateId('same');
      const id2 = generateId('same');
      expect(id1).not.toBe(id2);
    });

    it('should generate different IDs for different prefixes at same time', () => {
      const mockTime = 1_234_567_890;
      Date.now = vi.fn(() => mockTime);
      Math.random = vi.fn(() => 0.5);

      const id1 = generateId('prefix1');
      const id2 = generateId('prefix2');

      expect(id1).toContain('prefix1');
      expect(id2).toContain('prefix2');
      expect(id1).not.toBe(id2);
    });

    it('should handle empty prefix', () => {
      const id = generateId('');
      expect(id).toMatch(/^_\d+_[\da-z]{9}$/);
    });

    it('should handle special characters in prefix', () => {
      const id = generateId('test-prefix_123');
      expect(id).toMatch(/^test-prefix_123_\d+_[\da-z]{9}$/);
    });

    it('should generate IDs quickly in succession', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId('rapid'));
      }
      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should work with very long prefixes', () => {
      const longPrefix = 'a'.repeat(1000);
      const id = generateId(longPrefix);
      expect(id).toContain(longPrefix);
      expect(id).toMatch(new RegExp(`^${longPrefix}_\\d+_[a-z0-9]{9}$`));
    });

    it('should handle unicode characters in prefix', () => {
      const id = generateId('测试🚀');
      expect(id).toContain('测试🚀');
      expect(id).toMatch(/^测试🚀_\d+_[\da-z]{9}$/);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message from Error object', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should return message from custom Error subclass', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error message');
      expect(getErrorMessage(error)).toBe('Custom error message');
    });

    it('should convert string to string', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should convert number to string', () => {
      expect(getErrorMessage(404)).toBe('404');
      expect(getErrorMessage(0)).toBe('0');
      expect(getErrorMessage(-1)).toBe('-1');
      expect(getErrorMessage(3.14)).toBe('3.14');
    });

    it('should convert boolean to string', () => {
      expect(getErrorMessage(true)).toBe('true');
      expect(getErrorMessage(false)).toBe('false');
    });

    it('should handle null', () => {
      expect(getErrorMessage(null)).toBe('null');
    });

    it('should handle undefined', () => {
      expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('should convert object to string', () => {
      const obj = { error: 'test' };
      expect(getErrorMessage(obj)).toBe('[object Object]');
    });

    it('should convert object with toString to string', () => {
      const obj = {
        toString() {
          return 'Custom toString output';
        },
      };
      expect(getErrorMessage(obj)).toBe('Custom toString output');
    });

    it('should convert array to string', () => {
      expect(getErrorMessage([1, 2, 3])).toBe('1,2,3');
      expect(getErrorMessage(['a', 'b', 'c'])).toBe('a,b,c');
      expect(getErrorMessage([])).toBe('');
    });

    it('should handle Error with empty message', () => {
      const error = new Error('');
      expect(getErrorMessage(error)).toBe('');
    });

    it('should handle Error with no message', () => {
      const error = new Error();
      expect(getErrorMessage(error)).toBe('');
    });

    it('should handle complex error objects', () => {
      const complexError = {
        code: 'ERR_001',
        message: 'Complex error',
        toString() {
          return `${this.code}: ${this.message}`;
        },
      };
      expect(getErrorMessage(complexError)).toBe('ERR_001: Complex error');
    });

    it('should handle Symbol', () => {
      const sym = Symbol('test');
      expect(getErrorMessage(sym)).toBe('Symbol(test)');
    });

    it('should handle BigInt', () => {
      const bigInt = 9_007_199_254_740_991n;
      expect(getErrorMessage(bigInt)).toBe('9007199254740991');
    });

    it('should handle function', () => {
      const fn = function testFunction() {};
      expect(getErrorMessage(fn)).toContain('function');
    });

    it('should handle Error-like objects', () => {
      const errorLike = {
        message: 'Error-like message',
        stack: 'Some stack trace',
      };
      expect(getErrorMessage(errorLike)).toBe('[object Object]');
    });

    it('should handle nested errors', () => {
      const innerError = new Error('Inner error');
      const outerError = new Error(`Outer error: ${innerError.message}`);
      expect(getErrorMessage(outerError)).toBe('Outer error: Inner error');
    });

    it('should handle circular references in objects', () => {
      const circular: any = { prop: 'value' };
      circular.self = circular;

      // This might throw or return [object Object] depending on implementation
      const result = getErrorMessage(circular);
      expect(typeof result).toBe('string');
    });
  });
});
