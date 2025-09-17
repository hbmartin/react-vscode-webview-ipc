/**
 * Deferred promise for handling async responses with timeout management
 */
export class DeferredPromise<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (reason?: unknown) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
  private settled = false;

  constructor(readonly key: string) {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = (value: T) => {
        if (!this.settled) {
          this.settled = true;
          resolve(value);
        }
      };
      this.reject = (reason?: unknown) => {
        if (!this.settled) {
          this.settled = true;
          reject(reason instanceof Error ? reason : new Error(String(reason)));
        }
      };
    });
  }

  /**
   * Clear the timeout handle if it exists
   */
  clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  /**
   * Mark this deferred as settled to prevent further resolve/reject calls
   */
  markSettled(): void {
    this.settled = true;
  }
}
