import * as vscode from 'vscode';
import { disallowedLogKeys } from '..';
import { LogLevel, type ILogger } from './ILogger';

function removePromptsFromData<T>(dictionary: T | undefined | null): T | undefined {
  if (dictionary === null || dictionary === undefined) {
    return undefined;
  }
  if (Array.isArray(dictionary)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return dictionary.map((item) => removePromptsFromData(item)) as unknown as T;
  }
  if (typeof dictionary !== 'object') {
    return dictionary;
  }

  const clone = structuredClone(dictionary) as Record<string, unknown>;

  try {
    for (const key in clone) {
      const value = clone[key];
      if (disallowedLogKeys.includes(key)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete clone[key];
        continue;
      }
      if (Array.isArray(value)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        clone[key] = value.map((item) => removePromptsFromData(item)) as unknown;
      } else if (typeof value === 'object' && value !== null) {
        clone[key] = removePromptsFromData(value as Record<string, unknown>) as unknown;
      }
    }
  } catch (error) {
    console.error('Error processing log data:', error);
    return {} as T;
  }

  return clone as unknown as T;
}

/**
 * Static logger class for extension-wide logging
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class LoggerImpl {
  private static readonly outputChannel: vscode.OutputChannel =
    vscode.window.createOutputChannel('IPC');

  public static debug(message: string, data: Record<string, unknown> | undefined = undefined) {
    this.log(LogLevel.DEBUG, message, data);
  }

  public static info(message: string, data: Record<string, unknown> | undefined = undefined) {
    this.log(LogLevel.INFO, message, data);
  }

  public static warn(message: string, data: Record<string, unknown> | undefined = undefined) {
    this.log(LogLevel.WARN, message, data);
  }

  public static error(message: string, data: Record<string, unknown> | undefined = undefined) {
    this.log(LogLevel.ERROR, message, data);
  }

  public static dispose() {
    this.outputChannel.dispose();
  }

  private static log(level: LogLevel, message: string, data: Record<string, unknown> | undefined) {
    const timestamp = new Date().toISOString().split('T')[1];
    const levelStr = LogLevel[level] || 'UNKNOWN';
    const cleanedData = removePromptsFromData(data);
    const line = `[${timestamp}] [${levelStr}] ${message}`;
    if (cleanedData === undefined) {
      this.outputChannel.appendLine(line);
    } else {
      try {
        this.outputChannel.appendLine(`${line} : ${JSON.stringify(cleanedData)}`);
      } catch {
        this.outputChannel.appendLine(`${line} : unserializable data`);
      }
    }
  }
}

export const Logger: ILogger = {
  debug: (message: string, data?: Record<string, unknown>) => LoggerImpl.debug(message, data),
  info: (message: string, data?: Record<string, unknown>) => LoggerImpl.info(message, data),
  warn: (message: string, data?: Record<string, unknown>) => LoggerImpl.warn(message, data),
  error: (message: string, data?: Record<string, unknown>) => LoggerImpl.error(message, data),
  dispose: () => LoggerImpl.dispose(),
};

export const getLogger = (tag: string): ILogger => ({
  debug: (message: string, data?: Record<string, unknown>) =>
    LoggerImpl.debug(`[${tag}] ${message}`, data),
  info: (message: string, data?: Record<string, unknown>) =>
    LoggerImpl.info(`[${tag}] ${message}`, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    LoggerImpl.warn(`[${tag}] ${message}`, data),
  error: (message: string, data?: Record<string, unknown>) =>
    LoggerImpl.error(`[${tag}] ${message}`, data),
  dispose: () => {},
});
