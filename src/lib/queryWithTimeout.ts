/**
 * Wraps a promise with a timeout to prevent indefinite loading states.
 * If the promise doesn't resolve within the specified timeout, it rejects with a timeout error.
 */
export async function withTimeout<T>(
  promiseOrThenable: Promise<T> | PromiseLike<T>,
  timeoutMs: number = 15000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request timed out - please retry'));
    }, timeoutMs);
  });

  // Convert thenable to promise if needed
  const promise = Promise.resolve(promiseOrThenable);

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Execute a Supabase query with timeout protection.
 * Usage: const result = await executeWithTimeout(() => supabase.from('table').select('*'), 15000);
 */
export async function executeWithTimeout<T>(
  queryFn: () => PromiseLike<T>,
  timeoutMs: number = 15000
): Promise<T> {
  return withTimeout(queryFn(), timeoutMs);
}
