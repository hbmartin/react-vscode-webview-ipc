import { vi } from 'vitest';

// Mock VS Code Output Channel
const mockOutputChannel = {
  appendLine: vi.fn(),
  dispose: vi.fn(),
  append: vi.fn(),
  replace: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  name: 'IPC',
};

// Export mock VS Code API
export const window = {
  createOutputChannel: vi.fn(() => mockOutputChannel),
};

export const Uri = {
  joinPath: vi.fn((base: any, ...paths: string[]) => ({
    ...base,
    path: `${base.path}/${paths.join('/')}`,
  })),
  file: vi.fn((path: string) => ({
    scheme: 'file',
    authority: '',
    path,
    query: '',
    fragment: '',
    fsPath: path,
    with: vi.fn(),
    toString: vi.fn(() => `file://${path}`),
    toJSON: vi.fn(),
  })),
};

// Export for direct access in tests
export const __mockOutputChannel = mockOutputChannel;

// Mock other VS Code types and enums as needed
export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}

export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
