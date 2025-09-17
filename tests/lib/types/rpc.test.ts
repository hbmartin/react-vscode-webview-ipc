import { describe, it, expect } from 'vitest';
import {
  isViewApiRequest,
  isViewApiResponse,
  isViewApiError,
  isViewApiEvent,
  type ViewApiRequest,
  type ViewApiResponse,
  type ViewApiError,
  type ViewApiEvent,
  type RequestContext,
  type ClientCalls,
  type HostCalls,
} from '../../../src/lib/types/rpc';

// Test interfaces
interface TestClientCalls extends ClientCalls {
  fetchData: (id: string) => Promise<{ data: string }>;
  updateSettings: (settings: object) => Promise<void>;
}

interface TestHostCalls extends HostCalls {
  onDataUpdate: (data: any) => void;
  onError: (error: string) => void;
}

describe('rpc types', () => {
  describe('isViewApiRequest', () => {
    it('should return true for valid request without context', () => {
      const validRequest: ViewApiRequest<TestClientCalls> = {
        type: 'request',
        id: '123',
        key: 'fetchData',
        params: ['test-id'],
      };

      expect(isViewApiRequest<TestClientCalls>(validRequest)).toBe(true);
    });

    it('should return true for valid request with context', () => {
      const context: RequestContext = {
        viewId: 'view-123',
        viewType: 'custom',
        timestamp: Date.now(),
        sessionId: 'session-456',
      };

      const validRequest: ViewApiRequest<TestClientCalls> = {
        type: 'request',
        id: '123',
        key: 'updateSettings',
        params: [{ theme: 'dark' }],
        context,
      };

      expect(isViewApiRequest<TestClientCalls>(validRequest)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isViewApiRequest(null)).toBe(false);
      expect(isViewApiRequest(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isViewApiRequest('string')).toBe(false);
      expect(isViewApiRequest(123)).toBe(false);
      expect(isViewApiRequest(true)).toBe(false);
      expect(isViewApiRequest([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isViewApiRequest({ type: 'request' })).toBe(false);
      expect(isViewApiRequest({ type: 'request', id: '123' })).toBe(false);
      expect(isViewApiRequest({ type: 'request', id: '123', key: 'test' })).toBe(false);
      expect(isViewApiRequest({ id: '123', key: 'test', params: [] })).toBe(false);
    });

    it('should return false for incorrect field types', () => {
      expect(
        isViewApiRequest({
          type: 'wrong',
          id: '123',
          key: 'test',
          params: [],
        })
      ).toBe(false);

      expect(
        isViewApiRequest({
          type: 'request',
          id: 123, // should be string
          key: 'test',
          params: [],
        })
      ).toBe(false);

      expect(
        isViewApiRequest({
          type: 'request',
          id: '123',
          key: 123, // should be string
          params: [],
        })
      ).toBe(false);

      expect(
        isViewApiRequest({
          type: 'request',
          id: '123',
          key: 'test',
          params: 'not-array', // should be array
        })
      ).toBe(false);
    });

    it('should return false for invalid context', () => {
      expect(
        isViewApiRequest({
          type: 'request',
          id: '123',
          key: 'test',
          params: [],
          context: 'invalid', // should be object
        })
      ).toBe(false);

      expect(
        isViewApiRequest({
          type: 'request',
          id: '123',
          key: 'test',
          params: [],
          context: {
            viewId: 123, // should be string
            viewType: 'test',
            timestamp: Date.now(),
          },
        })
      ).toBe(false);

      expect(
        isViewApiRequest({
          type: 'request',
          id: '123',
          key: 'test',
          params: [],
          context: {
            viewId: 'test',
            viewType: 123, // should be string
            timestamp: Date.now(),
          },
        })
      ).toBe(false);

      expect(
        isViewApiRequest({
          type: 'request',
          id: '123',
          key: 'test',
          params: [],
          context: {
            viewId: 'test',
            viewType: 'test',
            timestamp: 'not-number', // should be number
          },
        })
      ).toBe(false);
    });

    it('should handle edge cases with empty params', () => {
      const request = {
        type: 'request',
        id: '123',
        key: 'test',
        params: [],
      };
      expect(isViewApiRequest(request)).toBe(true);
    });
  });

  describe('isViewApiResponse', () => {
    it('should return true for valid response with value', () => {
      const validResponse: ViewApiResponse<TestClientCalls> = {
        type: 'response',
        id: '123',
        value: { data: 'test' },
      };

      expect(isViewApiResponse<TestClientCalls>(validResponse)).toBe(true);
    });

    it('should return true for valid response without value', () => {
      const validResponse: ViewApiResponse<TestClientCalls> = {
        type: 'response',
        id: '123',
      };

      expect(isViewApiResponse<TestClientCalls>(validResponse)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isViewApiResponse(null)).toBe(false);
      expect(isViewApiResponse(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isViewApiResponse('string')).toBe(false);
      expect(isViewApiResponse(123)).toBe(false);
      expect(isViewApiResponse(true)).toBe(false);
      expect(isViewApiResponse([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isViewApiResponse({ type: 'response' })).toBe(false);
      expect(isViewApiResponse({ id: '123' })).toBe(false);
    });

    it('should return false for incorrect field types', () => {
      expect(
        isViewApiResponse({
          type: 'wrong',
          id: '123',
        })
      ).toBe(false);

      expect(
        isViewApiResponse({
          type: 'response',
          id: 123, // should be string
        })
      ).toBe(false);
    });

    it('should handle responses with various value types', () => {
      expect(
        isViewApiResponse({
          type: 'response',
          id: '123',
          value: null,
        })
      ).toBe(true);

      expect(
        isViewApiResponse({
          type: 'response',
          id: '123',
          value: undefined,
        })
      ).toBe(true);

      expect(
        isViewApiResponse({
          type: 'response',
          id: '123',
          value: { complex: { nested: 'object' } },
        })
      ).toBe(true);
    });
  });

  describe('isViewApiError', () => {
    it('should return true for valid error', () => {
      const validError: ViewApiError = {
        type: 'error',
        id: '123',
        value: 'An error occurred',
      };

      expect(isViewApiError(validError)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isViewApiError(null)).toBe(false);
      expect(isViewApiError(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isViewApiError('string')).toBe(false);
      expect(isViewApiError(123)).toBe(false);
      expect(isViewApiError(true)).toBe(false);
      expect(isViewApiError([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isViewApiError({ type: 'error' })).toBe(false);
      expect(isViewApiError({ type: 'error', id: '123' })).toBe(false);
      expect(isViewApiError({ type: 'error', value: 'error' })).toBe(false);
      expect(isViewApiError({ id: '123', value: 'error' })).toBe(false);
    });

    it('should return false for incorrect field types', () => {
      expect(
        isViewApiError({
          type: 'wrong',
          id: '123',
          value: 'error',
        })
      ).toBe(false);

      expect(
        isViewApiError({
          type: 'error',
          id: 123, // should be string
          value: 'error',
        })
      ).toBe(false);

      expect(
        isViewApiError({
          type: 'error',
          id: '123',
          value: 123, // should be string
        })
      ).toBe(false);
    });

    it('should handle empty error messages', () => {
      expect(
        isViewApiError({
          type: 'error',
          id: '123',
          value: '',
        })
      ).toBe(true);
    });
  });

  describe('isViewApiEvent', () => {
    it('should return true for valid event', () => {
      const validEvent: ViewApiEvent<TestHostCalls> = {
        type: 'event',
        key: 'onDataUpdate',
        value: [{ data: 'test' }],
      };

      expect(isViewApiEvent<TestHostCalls>(validEvent)).toBe(true);
    });

    it('should return true for event with empty value array', () => {
      const validEvent: ViewApiEvent<TestHostCalls> = {
        type: 'event',
        key: 'onError',
        value: [],
      };

      expect(isViewApiEvent<TestHostCalls>(validEvent)).toBe(true);
    });

    it('should return false for null or undefined', () => {
      expect(isViewApiEvent(null)).toBe(false);
      expect(isViewApiEvent(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isViewApiEvent('string')).toBe(false);
      expect(isViewApiEvent(123)).toBe(false);
      expect(isViewApiEvent(true)).toBe(false);
      expect(isViewApiEvent([])).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isViewApiEvent({ type: 'event' })).toBe(false);
      expect(isViewApiEvent({ type: 'event', key: 'test' })).toBe(false);
      expect(isViewApiEvent({ type: 'event', value: [] })).toBe(false);
      expect(isViewApiEvent({ key: 'test', value: [] })).toBe(false);
    });

    it('should return false for incorrect field types', () => {
      expect(
        isViewApiEvent({
          type: 'wrong',
          key: 'test',
          value: [],
        })
      ).toBe(false);

      expect(
        isViewApiEvent({
          type: 'event',
          key: 123, // should be string
          value: [],
        })
      ).toBe(false);

      expect(
        isViewApiEvent({
          type: 'event',
          key: 'test',
          value: 'not-array', // should be array
        })
      ).toBe(false);
    });

    it('should handle events with complex value arrays', () => {
      expect(
        isViewApiEvent({
          type: 'event',
          key: 'test',
          value: [1, 'string', { obj: true }, [1, 2, 3]],
        })
      ).toBe(true);
    });
  });

  describe('Type definitions', () => {
    it('should correctly type ClientCalls', () => {
      const clientCalls: TestClientCalls = {
        fetchData: async (id: string) => ({ data: `Data for ${id}` }),
        updateSettings: async (_settings: object) => undefined,
      };

      expect(clientCalls.fetchData).toBeDefined();
      expect(clientCalls.updateSettings).toBeDefined();
    });

    it('should correctly type HostCalls', () => {
      const hostCalls: TestHostCalls = {
        onDataUpdate: (_data: any) => {},
        onError: (_error: string) => {},
      };

      expect(hostCalls.onDataUpdate).toBeDefined();
      expect(hostCalls.onError).toBeDefined();
    });

    it('should correctly type RequestContext', () => {
      const context: RequestContext = {
        viewId: 'view-123',
        viewType: 'custom',
        timestamp: Date.now(),
      };

      expect(context.viewId).toBeDefined();
      expect(context.viewType).toBeDefined();
      expect(context.timestamp).toBeDefined();

      const contextWithSession: RequestContext = {
        ...context,
        sessionId: 'session-456',
      };

      expect(contextWithSession.sessionId).toBeDefined();
    });
  });
});
