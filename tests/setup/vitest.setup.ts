import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock VS Code API for client-side tests
export const mockVsCodeApi = {
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
};

// Mock acquireVsCodeApi function
(globalThis as any).acquireVsCodeApi = vi.fn(() => mockVsCodeApi);

// Polyfill structuredClone if not available
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj: any) => {
    // Check for circular references and functions
    const seen = new WeakSet();

    function checkForProblems(value: any, path = ''): void {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'function') {
          throw new Error(`${value} could not be cloned.`);
        }
        return;
      }

      if (seen.has(value)) {
        throw new Error('Converting circular structure to JSON');
      }

      seen.add(value);

      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          checkForProblems(value[key], path + '.' + key);
        }
      }
    }

    // Check for problems first
    checkForProblems(obj);

    // If no problems, clone normally
    return JSON.parse(JSON.stringify(obj));
  };
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockVsCodeApi.postMessage.mockClear();
  mockVsCodeApi.getState.mockClear();
  mockVsCodeApi.setState.mockClear();
});
