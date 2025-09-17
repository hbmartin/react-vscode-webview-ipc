import { describe, it, expect } from 'vitest';
import { isMyActionMessage } from '../../../src/lib/host/utils';
import { ACT, type WebviewKey, type Action } from '../../../src/lib/types/reducer';

interface TestActions {
  testMethod: (arg: string) => void;
  otherMethod: (n: number) => Promise<string>;
}

describe('host/utils', () => {
  describe('isMyActionMessage', () => {
    const validProviderId = 'test-provider-123' as WebviewKey;
    const differentProviderId = 'different-provider' as WebviewKey;

    it('should return true for valid action message with matching provider ID', () => {
      const validAction: Action<TestActions> = {
        type: ACT,
        providerId: validProviderId,
        key: 'testMethod',
        params: ['test-arg'],
      };

      expect(isMyActionMessage<TestActions>(validAction, validProviderId)).toBe(true);
    });

    it('should return false for valid action with different provider ID', () => {
      const action: Action<TestActions> = {
        type: ACT,
        providerId: differentProviderId,
        key: 'testMethod',
        params: ['test-arg'],
      };

      expect(isMyActionMessage<TestActions>(action, validProviderId)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isMyActionMessage(null, validProviderId)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMyActionMessage(undefined, validProviderId)).toBe(false);
    });

    it('should return false for non-object primitives', () => {
      expect(isMyActionMessage('string', validProviderId)).toBe(false);
      expect(isMyActionMessage(123, validProviderId)).toBe(false);
      expect(isMyActionMessage(true, validProviderId)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isMyActionMessage([], validProviderId)).toBe(false);
      expect(isMyActionMessage([{ type: ACT }], validProviderId)).toBe(false);
    });

    it('should return false when missing required fields', () => {
      expect(
        isMyActionMessage(
          {
            // missing all fields
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            // missing providerId, key, params
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            // missing key, params
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: 'testMethod',
            // missing params
          },
          validProviderId
        )
      ).toBe(false);
    });

    it('should return false when type is not ACT', () => {
      expect(
        isMyActionMessage(
          {
            type: 'patch',
            providerId: validProviderId,
            key: 'testMethod',
            params: [],
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: 'other',
            providerId: validProviderId,
            key: 'testMethod',
            params: [],
          },
          validProviderId
        )
      ).toBe(false);
    });

    it('should return false when providerId is not a string', () => {
      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: 123,
            key: 'testMethod',
            params: [],
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: null,
            key: 'testMethod',
            params: [],
          },
          validProviderId
        )
      ).toBe(false);
    });

    it('should accept string key', () => {
      const action = {
        type: ACT,
        providerId: validProviderId,
        key: 'stringKey',
        params: [],
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(true);
    });

    it('should accept symbol key', () => {
      const symbolKey = Symbol('testSymbol');
      const action = {
        type: ACT,
        providerId: validProviderId,
        key: symbolKey,
        params: [],
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(true);
    });

    it('should return false when key is neither string nor symbol', () => {
      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: 123,
            params: [],
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: null,
            params: [],
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: { obj: 'key' },
            params: [],
          },
          validProviderId
        )
      ).toBe(false);
    });

    it('should return false when params is not an array', () => {
      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: 'testMethod',
            params: 'not-array',
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: 'testMethod',
            params: { obj: true },
          },
          validProviderId
        )
      ).toBe(false);

      expect(
        isMyActionMessage(
          {
            type: ACT,
            providerId: validProviderId,
            key: 'testMethod',
            params: 123,
          },
          validProviderId
        )
      ).toBe(false);
    });

    it('should accept empty params array', () => {
      const action = {
        type: ACT,
        providerId: validProviderId,
        key: 'testMethod',
        params: [],
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(true);
    });

    it('should accept params array with various types', () => {
      const action = {
        type: ACT,
        providerId: validProviderId,
        key: 'testMethod',
        params: ['string', 123, true, null, { obj: 'value' }, [1, 2, 3]],
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(true);
    });

    it('should be case-sensitive for provider ID', () => {
      const action = {
        type: ACT,
        providerId: 'TEST-PROVIDER',
        key: 'testMethod',
        params: [],
      };

      expect(isMyActionMessage(action, 'test-provider' as WebviewKey)).toBe(false);
      expect(isMyActionMessage(action, 'TEST-PROVIDER' as WebviewKey)).toBe(true);
    });

    it('should handle edge cases with special characters in provider ID', () => {
      const specialProviderId = 'provider-with-special-chars_123.456' as WebviewKey;
      const action = {
        type: ACT,
        providerId: specialProviderId,
        key: 'testMethod',
        params: [],
      };

      expect(isMyActionMessage(action, specialProviderId)).toBe(true);
    });

    it('should handle provider ID with unicode characters', () => {
      const unicodeProviderId = 'provider-测试-🚀' as WebviewKey;
      const action = {
        type: ACT,
        providerId: unicodeProviderId,
        key: 'testMethod',
        params: [],
      };

      expect(isMyActionMessage(action, unicodeProviderId)).toBe(true);
    });

    it('should return false for objects with extra properties but missing required ones', () => {
      const action = {
        type: ACT,
        providerId: validProviderId,
        extraProp: 'extra',
        anotherProp: 123,
        // missing key and params
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(false);
    });

    it('should return true for valid action with extra properties', () => {
      const action = {
        type: ACT,
        providerId: validProviderId,
        key: 'testMethod',
        params: [],
        extraProp: 'extra',
        metadata: { timestamp: Date.now() },
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(true);
    });

    it('should handle complex parameter types', () => {
      const action = {
        type: ACT,
        providerId: validProviderId,
        key: 'testMethod',
        params: [
          { complex: { nested: { object: true } } },
          () => {}, // function
          new Date(),
          undefined,
        ],
      };

      expect(isMyActionMessage(action, validProviderId)).toBe(true);
    });
  });
});
