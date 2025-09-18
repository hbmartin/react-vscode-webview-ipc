import { LogLevel, type ILogger } from '../types';
import { createConsoleLogger } from '../utils';
import type * as vscode from 'vscode';

export const disallowedLogKeys = ['password', 'secret', 'token', 'apiKey', 'apiSecret', 'content'];

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

  try {
    const clone = structuredClone(dictionary) as Record<string, unknown>;
    for (const [key, value] of Object.entries(clone)) {
      if (disallowedLogKeys.includes(key.toLowerCase())) {
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
    return clone as unknown as T;
  } catch (error) {
    console.error('Error processing log data:', error);
    return {} as T;
  }
}

/**
 * Static logger class for extension-wide logging
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class LoggerImpl {
  // eslint-disable-next-line sonarjs/public-static-readonly
  static outputChannel: vscode.OutputChannel | undefined = undefined;
  private static readonly consoleLogger = createConsoleLogger('RVW');

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
    this.outputChannel?.dispose();
    this.outputChannel = undefined;
  }

  private static log(level: LogLevel, message: string, data: Record<string, unknown> | undefined) {
    const timestamp = new Date().toISOString().split('T')[1];
    const cleanedData = removePromptsFromData(data);
    if (this.outputChannel === undefined) {
      const methodName = LogLevel[level].toLowerCase() as
        | undefined
        | keyof Omit<ILogger, 'dispose'>;
      if (methodName !== undefined && typeof this.consoleLogger[methodName] === 'function') {
        if (cleanedData === undefined) {
          this.consoleLogger[methodName](`[${timestamp}] ${message}`);
        } else {
          this.consoleLogger[methodName](`[${timestamp}] ${message}`, cleanedData);
        }
      }
    } else {
      const levelStr = LogLevel[level] || 'UNKNOWN';
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
}

export const Logger: ILogger & {
  setOutputChannel: (outputChannel: vscode.OutputChannel | undefined) => void;
} =
  /**
   * Sets the VS Code output channel for the logger.
   * The logger takes ownership of the channel and will dispose it
   * when `Logger.dispose()` is called or when a new channel is set.
   * @param outputChannel The output channel to use for logging.
   */
  {
    setOutputChannel: (outputChannel: vscode.OutputChannel | undefined) => {
      LoggerImpl.dispose();
      LoggerImpl.outputChannel = outputChannel;
    },
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
