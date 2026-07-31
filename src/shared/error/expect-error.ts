/**
 * Wraps a promise to catch and return specific errors, allowing for type-safe error handling.
 * If the promise resolves, it returns `[undefined, data]`.
 * If the promise rejects with an error that matches one of the `errorsToCatch`, it returns `[error]`.
 * If the promise rejects with an unhandled error, it re-throws the error.
 *
 * @template T The type of the data returned by the promise.
 * @template E The type of the error constructor.
 * @param promise - The promise to wrap.
 * @param errorsToCatch - An array of error constructors to catch. If undefined, all errors are caught.
 * @returns A promise that resolves to either a tuple with the error or a tuple with the data.
 */
export async function expectError<T, E extends new (message?: string) => Error>(
  promise: Promise<T>,
  errorsToCatch?: E[]
): Promise<[undefined, T] | [InstanceType<E>]> {
  return promise
    .then((data) => {
      return [undefined, data] as [undefined, T];
    })
    .catch((error) => {
      if (errorsToCatch === undefined) {
        return [error];
      }
      if (errorsToCatch.some((e) => error instanceof e)) {
        return [error];
      }
      throw error;
    });
}
