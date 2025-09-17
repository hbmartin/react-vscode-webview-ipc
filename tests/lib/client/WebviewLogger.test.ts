import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebviewLogger } from '../../../src/lib/client/WebviewLogger';
import { LogLevel } from '../../../src/lib/types';
import type { VsCodeApi } from '../../../src/lib/client/types';

describe('WebviewLogger', () => {
  let mockVsCodeApi: VsCodeApi;
  let logger: WebviewLogger;

  beforeEach(() => {
    mockVsCodeApi = {
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    };

    logger = new WebviewLogger(mockVsCodeApi, 'TestLogger');
  });

  describe('constructor', () => {
    it('should create logger with tag', () => {
      expect(logger.tag).toBe('TestLogger');
    });

    it('should accept custom tags', () => {
      const customLogger = new WebviewLogger(mockVsCodeApi, 'CustomTag');
      expect(customLogger.tag).toBe('CustomTag');
    });
  });

  describe('debug', () => {
    it('should post debug message with correct format', () => {
      logger.debug('Debug message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.DEBUG,
        message: '[TestLogger] Debug message',
        data: undefined,
      });
    });

    it('should include data when provided', () => {
      const testData = { userId: '123', action: 'click' };
      logger.debug('User action', testData);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.DEBUG,
        message: '[TestLogger] User action',
        data: testData,
      });
    });

    it('should handle empty messages', () => {
      logger.debug('');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.DEBUG,
        message: '[TestLogger] ',
        data: undefined,
      });
    });
  });

  describe('info', () => {
    it('should post info message with correct format', () => {
      logger.info('Info message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.INFO,
        message: '[TestLogger] Info message',
        data: undefined,
      });
    });

    it('should include data when provided', () => {
      const testData = { status: 'success', count: 5 };
      logger.info('Operation completed', testData);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.INFO,
        message: '[TestLogger] Operation completed',
        data: testData,
      });
    });
  });

  describe('warn', () => {
    it('should post warn message with correct format', () => {
      logger.warn('Warning message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.WARN,
        message: '[TestLogger] Warning message',
        data: undefined,
      });
    });

    it('should include data when provided', () => {
      const testData = { deprecated: true, replacement: 'newMethod' };
      logger.warn('Deprecated method used', testData);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.WARN,
        message: '[TestLogger] Deprecated method used',
        data: testData,
      });
    });
  });

  describe('error', () => {
    it('should post error message with correct format', () => {
      logger.error('Error message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.ERROR,
        message: '[TestLogger] Error message',
        data: undefined,
      });
    });

    it('should include data when provided', () => {
      const testData = { errorCode: 500, stack: 'Error stack trace' };
      logger.error('Server error occurred', testData);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.ERROR,
        message: '[TestLogger] Server error occurred',
        data: testData,
      });
    });
  });

  describe('dispose', () => {
    it('should not throw when called', () => {
      expect(() => logger.dispose()).not.toThrow();
    });

    it('should be callable multiple times', () => {
      logger.dispose();
      logger.dispose();
      expect(() => logger.dispose()).not.toThrow();
    });
  });

  describe('integration tests', () => {
    it('should log different levels in sequence', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledTimes(4);
      expect(mockVsCodeApi.postMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          level: LogLevel.DEBUG,
          message: '[TestLogger] Debug message',
        })
      );
      expect(mockVsCodeApi.postMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          level: LogLevel.INFO,
          message: '[TestLogger] Info message',
        })
      );
      expect(mockVsCodeApi.postMessage).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          level: LogLevel.WARN,
          message: '[TestLogger] Warning message',
        })
      );
      expect(mockVsCodeApi.postMessage).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: '[TestLogger] Error message',
        })
      );
    });

    it('should handle complex data objects', () => {
      const complexData = {
        user: { id: '123', name: 'John' },
        metadata: { timestamp: Date.now(), version: '1.0.0' },
        items: [1, 2, 3],
        nested: { deep: { value: 'test' } },
      };

      logger.info('Complex data logged', complexData);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith({
        type: 'log',
        level: LogLevel.INFO,
        message: '[TestLogger] Complex data logged',
        data: complexData,
      });
    });

    it('should handle null and undefined data', () => {
      logger.info('Message with null', null as any);
      logger.warn('Message with undefined', undefined);

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledTimes(2);
      expect(mockVsCodeApi.postMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: null,
        })
      );
      expect(mockVsCodeApi.postMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: undefined,
        })
      );
    });
  });

  describe('tag formatting', () => {
    it('should handle special characters in tag', () => {
      const specialLogger = new WebviewLogger(mockVsCodeApi, 'Test-Logger_123');
      specialLogger.info('Test message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Test-Logger_123] Test message',
        })
      );
    });

    it('should handle empty tag', () => {
      const emptyTagLogger = new WebviewLogger(mockVsCodeApi, '');
      emptyTagLogger.info('Test message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[] Test message',
        })
      );
    });

    it('should handle long tag names', () => {
      const longTag = 'VeryLongLoggerTagNameThatExceedsTypicalLength';
      const longTagLogger = new WebviewLogger(mockVsCodeApi, longTag);
      longTagLogger.info('Test message');

      expect(mockVsCodeApi.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `[${longTag}] Test message`,
        })
      );
    });
  });
});
