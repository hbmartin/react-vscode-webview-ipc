import { describe, it, expect, vi } from 'vitest';
import { isLogMessage, LogLevel, type LogMessage, type ILogger } from '../../../src/lib/types/log';

describe('log types', () => {
  describe('LogLevel enum', () => {
    it('should have correct values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });

    it('should be usable in comparisons', () => {
      expect(LogLevel.ERROR > LogLevel.WARN).toBe(true);
      expect(LogLevel.INFO < LogLevel.WARN).toBe(true);
      expect(LogLevel.DEBUG < LogLevel.ERROR).toBe(true);
    });
  });

  describe('isLogMessage', () => {
    it('should return true for valid log message', () => {
      const validMessage: LogMessage = {
        type: 'log',
        level: LogLevel.INFO,
        message: 'Test message',
      };

      expect(isLogMessage(validMessage)).toBe(true);
    });

    it('should return true for log message with data', () => {
      const validMessage: LogMessage = {
        type: 'log',
        level: LogLevel.ERROR,
        message: 'Error occurred',
        data: { error: 'Details', code: 500 },
      };

      expect(isLogMessage(validMessage)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isLogMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isLogMessage(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isLogMessage('string')).toBe(false);
      expect(isLogMessage(123)).toBe(false);
      expect(isLogMessage(true)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isLogMessage([])).toBe(false);
      expect(isLogMessage([{ type: 'log', level: 0, message: 'test' }])).toBe(false);
    });

    it('should return false when type is not "log"', () => {
      expect(
        isLogMessage({
          type: 'other',
          level: LogLevel.INFO,
          message: 'Test',
        })
      ).toBe(false);

      expect(
        isLogMessage({
          type: undefined,
          level: LogLevel.INFO,
          message: 'Test',
        })
      ).toBe(false);
    });

    it('should return false when level is not a number', () => {
      expect(
        isLogMessage({
          type: 'log',
          level: 'INFO',
          message: 'Test',
        })
      ).toBe(false);

      expect(
        isLogMessage({
          type: 'log',
          level: null,
          message: 'Test',
        })
      ).toBe(false);

      expect(
        isLogMessage({
          type: 'log',
          level: undefined,
          message: 'Test',
        })
      ).toBe(false);
    });

    it('should return false when message is not a string', () => {
      expect(
        isLogMessage({
          type: 'log',
          level: LogLevel.INFO,
          message: 123,
        })
      ).toBe(false);

      expect(
        isLogMessage({
          type: 'log',
          level: LogLevel.INFO,
          message: { text: 'Test' },
        })
      ).toBe(false);

      expect(
        isLogMessage({
          type: 'log',
          level: LogLevel.INFO,
          message: null,
        })
      ).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(
        isLogMessage({
          type: 'log',
          level: LogLevel.INFO,
          // missing message
        })
      ).toBe(false);

      expect(
        isLogMessage({
          type: 'log',
          // missing level
          message: 'Test',
        })
      ).toBe(false);

      expect(
        isLogMessage({
          // missing type
          level: LogLevel.INFO,
          message: 'Test',
        })
      ).toBe(false);
    });

    it('should handle edge cases', () => {
      // Empty message string is valid
      expect(
        isLogMessage({
          type: 'log',
          level: LogLevel.DEBUG,
          message: '',
        })
      ).toBe(true);

      // Level 0 (DEBUG) is valid
      expect(
        isLogMessage({
          type: 'log',
          level: 0,
          message: 'Debug',
        })
      ).toBe(true);

      // Negative level is technically valid as it's a number
      expect(
        isLogMessage({
          type: 'log',
          level: -1,
          message: 'Test',
        })
      ).toBe(true);

      // Data can be any object
      expect(
        isLogMessage({
          type: 'log',
          level: LogLevel.INFO,
          message: 'Test',
          data: { nested: { deep: { value: true } } },
        })
      ).toBe(true);
    });
  });

  describe('ILogger interface', () => {
    it('should be implementable', () => {
      const mockLogger: ILogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        dispose: vi.fn(),
      };

      // Test that methods can be called
      mockLogger.debug('Debug message');
      mockLogger.info('Info message', { extra: 'data' });
      mockLogger.warn('Warning message');
      mockLogger.error('Error message', { code: 500 });
      mockLogger.dispose();

      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message');
      expect(mockLogger.info).toHaveBeenCalledWith('Info message', { extra: 'data' });
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message');
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', { code: 500 });
      expect(mockLogger.dispose).toHaveBeenCalled();
    });

    it('should handle optional data parameter', () => {
      const mockLogger: ILogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        dispose: vi.fn(),
      };

      // Call without data
      mockLogger.debug('Message only');
      expect(mockLogger.debug).toHaveBeenCalledWith('Message only');

      // Call with data
      mockLogger.debug('Message with data', { key: 'value' });
      expect(mockLogger.debug).toHaveBeenCalledWith('Message with data', { key: 'value' });
    });
  });

  describe('LogMessage type', () => {
    it('should allow creating valid log messages', () => {
      const messages: LogMessage[] = [
        {
          type: 'log',
          level: LogLevel.DEBUG,
          message: 'Debug message',
        },
        {
          type: 'log',
          level: LogLevel.INFO,
          message: 'Info message',
          data: { timestamp: Date.now() },
        },
        {
          type: 'log',
          level: LogLevel.WARN,
          message: 'Warning message',
          data: undefined,
        },
        {
          type: 'log',
          level: LogLevel.ERROR,
          message: 'Error message',
          data: { error: new Error('Test error').message },
        },
      ];

      for (const msg of messages) {
        expect(isLogMessage(msg)).toBe(true);
      }
    });

    it('should handle complex data structures', () => {
      const message: LogMessage = {
        type: 'log',
        level: LogLevel.INFO,
        message: 'Complex data',
        data: {
          string: 'value',
          number: 123,
          boolean: true,
          null: null,
          undefined: undefined,
          array: [1, 2, 3],
          object: { nested: 'object' },
          date: new Date().toISOString(),
        },
      };

      expect(isLogMessage(message)).toBe(true);
    });
  });
});
