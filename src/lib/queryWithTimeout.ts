/**
 * Wraps a Supabase query with a timeout using AbortController.
 * If the query doesn't complete within the specified timeout, it will be aborted.
 */
export function createTimeoutSignal(timeoutMs: number = 15000): { 
  signal: AbortSignal; 
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

/**
 * Simple timeout wrapper that works with any promise.
 * Returns a rejected promise if the timeout is reached.
 */
export function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number = 15000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Request timed out - please retry'));
      }
    }, timeoutMs);

    Promise.resolve(promise)
      .then(result => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch(error => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      });
  });
}
