import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, getLogger, disallowedLogKeys } from '../../../src/lib/host/logger';
import { __mockOutputChannel } from '../../setup/__mocks__/vscode';

describe('host/logger', () => {
  let mockOutputChannel: any;
  let originalDateNow: typeof Date.prototype.toISOString;

  beforeEach(() => {
    mockOutputChannel = __mockOutputChannel;
    mockOutputChannel.appendLine.mockClear();
    mockOutputChannel.dispose.mockClear();

    // Route Logger output to the mocked VS Code output channel
    Logger.setOutputChannel(mockOutputChannel);

    // Mock date for consistent timestamps
    originalDateNow = Date.prototype.toISOString;
    Date.prototype.toISOString = vi.fn(() => '2024-01-01T12:00:00.000Z');
  });

  afterEach(() => {
    Date.prototype.toISOString = originalDateNow;
    vi.clearAllMocks();
    // Reset output channel between tests
    Logger.setOutputChannel(undefined);
  });

  describe('Logger static methods', () => {
    describe('debug', () => {
      it('should log debug message without data', () => {
        Logger.debug('Debug message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [DEBUG] Debug message'
        );
      });

      it('should log debug message with data', () => {
        Logger.debug('Debug message', { key: 'value' });
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [DEBUG] Debug message : {"key":"value"}'
        );
      });
    });

    describe('info', () => {
      it('should log info message without data', () => {
        Logger.info('Info message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [INFO] Info message'
        );
      });

      it('should log info message with data', () => {
        Logger.info('Info message', { count: 42 });
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [INFO] Info message : {"count":42}'
        );
      });
    });

    describe('warn', () => {
      it('should log warning message without data', () => {
        Logger.warn('Warning message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [WARN] Warning message'
        );
      });

      it('should log warning message with data', () => {
        Logger.warn('Warning message', { warning: true });
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [WARN] Warning message : {"warning":true}'
        );
      });
    });

    describe('error', () => {
      it('should log error message without data', () => {
        Logger.error('Error message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [ERROR] Error message'
        );
      });

      it('should log error message with data', () => {
        Logger.error('Error message', { code: 500, message: 'Internal error' });
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
          '[12:00:00.000Z] [ERROR] Error message : {"code":500,"message":"Internal error"}'
        );
      });
    });

    describe('dispose', () => {
      it('should dispose the output channel', () => {
        Logger.dispose();
        expect(mockOutputChannel.dispose).toHaveBeenCalled();
      });
    });
  });

  describe('Data sanitization', () => {
    it('should remove password from data', () => {
      Logger.info('Test', { password: 'secret123', safe: 'data' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"safe":"data"}'
      );
    });

    it('should remove secret from data', () => {
      Logger.info('Test', { secret: 'hidden', public: 'visible' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"public":"visible"}'
      );
    });

    it('should remove token from data', () => {
      Logger.info('Test', { token: 'jwt123', userId: 123 });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"userId":123}'
      );
    });

    it('should remove apiKey from data', () => {
      Logger.info('Test', { apiKey: 'key123', endpoint: '/api' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"endpoint":"/api"}'
      );
    });

    it('should remove apiSecret from data', () => {
      Logger.info('Test', { apiSecret: 'secret', status: 'ok' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"status":"ok"}'
      );
    });

    it('should remove content from data', () => {
      Logger.info('Test', { content: 'sensitive', metadata: 'safe' });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"metadata":"safe"}'
      );
    });

    it('should remove multiple disallowed keys', () => {
      Logger.info('Test', {
        password: 'pass',
        token: 'tok',
        apiKey: 'key',
        valid: 'data',
      });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"valid":"data"}'
      );
    });

    it('should sanitize nested objects', () => {
      Logger.info('Test', {
        user: {
          name: 'John',
          password: 'secret',
          nested: {
            token: 'hidden',
            public: 'visible',
          },
        },
      });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"user":{"name":"John","nested":{"public":"visible"}}}'
      );
    });

    it('should sanitize arrays', () => {
      Logger.info('Test', {
        items: [
          { password: 'secret1', id: 1 },
          { token: 'secret2', id: 2 },
        ],
      });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"items":[{"id":1},{"id":2}]}'
      );
    });

    it('should handle arrays with nested objects', () => {
      Logger.info('Test', {
        data: [
          {
            user: { password: 'secret', name: 'User1' },
            public: 'info1',
          },
          {
            apiKey: 'key',
            public: 'info2',
          },
        ],
      });
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : {"data":[{"user":{"name":"User1"},"public":"info1"},{"public":"info2"}]}'
      );
    });

    it('should handle null data', () => {
      Logger.info('Test', null as any);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('[12:00:00.000Z] [INFO] Test');
    });

    it('should handle undefined data', () => {
      Logger.info('Test', undefined);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('[12:00:00.000Z] [INFO] Test');
    });

    it('should handle non-object data gracefully', () => {
      Logger.info('Test', 'string' as any);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : "string"'
      );
    });

    it('should handle circular references', () => {
      const circular: any = { safe: 'data' };
      circular.self = circular;

      // structuredClone will throw on circular references
      const originalConsoleError = console.error;
      console.error = vi.fn();

      Logger.info('Test', circular);

      // In our test environment, the polyfill handles this differently than native
      // The important thing is that it doesn't crash and produces some output
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1);
      const call = mockOutputChannel.appendLine.mock.calls[0][0];
      expect(call).toContain('[12:00:00.000Z] [INFO] Test :');

      console.error = originalConsoleError;
    });

    it('should handle unserializable data', () => {
      const unserializable = {
        // Don't use function, as structuredClone throws before the try-catch
        bigInt: 9_007_199_254_740_991n,
      };

      // BigInt will cause JSON.stringify to fail, triggering the fallback
      Logger.info('Test', unserializable as any);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Test : unserializable data'
      );
    });
  });

  describe('getLogger', () => {
    it('should create tagged logger', () => {
      const taggedLogger = getLogger('MyComponent');

      taggedLogger.debug('Debug message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [DEBUG] [MyComponent] Debug message'
      );

      taggedLogger.info('Info message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] [MyComponent] Info message'
      );

      taggedLogger.warn('Warn message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [WARN] [MyComponent] Warn message'
      );

      taggedLogger.error('Error message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [ERROR] [MyComponent] Error message'
      );
    });

    it('should sanitize data in tagged logger', () => {
      const taggedLogger = getLogger('Security');

      taggedLogger.info('User login', {
        username: 'john',
        password: 'secret123',
      });

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] [Security] User login : {"username":"john"}'
      );
    });

    it('should handle dispose for tagged logger', () => {
      const taggedLogger = getLogger('Test');
      taggedLogger.dispose();
      // Tagged logger dispose is a no-op, should not dispose the shared channel
      expect(mockOutputChannel.dispose).not.toHaveBeenCalled();
    });

    it('should handle multiple tagged loggers', () => {
      const logger1 = getLogger('Component1');
      const logger2 = getLogger('Component2');

      logger1.info('Message 1');
      logger2.info('Message 2');

      expect(mockOutputChannel.appendLine).toHaveBeenNthCalledWith(
        1,
        '[12:00:00.000Z] [INFO] [Component1] Message 1'
      );
      expect(mockOutputChannel.appendLine).toHaveBeenNthCalledWith(
        2,
        '[12:00:00.000Z] [INFO] [Component2] Message 2'
      );
    });

    it('should handle special characters in tags', () => {
      const logger = getLogger('Component[Test]:123');
      logger.info('Test message');

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] [Component[Test]:123] Test message'
      );
    });
  });

  describe('disallowedLogKeys', () => {
    it('should export correct disallowed keys', () => {
      // Recent change: exported as Set with lowercase API keys
      expect(disallowedLogKeys).toEqual(
        new Set(['password', 'secret', 'token', 'apikey', 'apisecret', 'content'])
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string messages', () => {
      Logger.info('');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('[12:00:00.000Z] [INFO] ');
    });

    it('should handle very long messages', () => {
      const longMessage = 'a'.repeat(10_000);
      Logger.info(longMessage);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        `[12:00:00.000Z] [INFO] ${longMessage}`
      );
    });

    it('should handle complex nested structures', () => {
      const complexData = {
        level1: {
          level2: {
            level3: {
              password: 'secret',
              data: [
                { token: 'tok1', id: 1 },
                { apiKey: 'key1', id: 2 },
              ],
              safe: 'value',
            },
          },
        },
      };

      Logger.info('Complex', complexData);

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        '[12:00:00.000Z] [INFO] Complex : {"level1":{"level2":{"level3":{"data":[{"id":1},{"id":2}],"safe":"value"}}}}'
      );
    });
  });
});
