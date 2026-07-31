import type { DiffChunk } from "@src/shared";

/** The maximum number of tokens allowed in a single chunk. */
export const MAX_TOKENS_PER_CHUNK = 10000;
/** The maximum number of chunks to process concurrently. */
export const MAX_CONCURRENT_CHUNKS = 3;

/**
 * Splits an array of items into chunks based on a maximum token count.
 * This is used to ensure that diffs sent to the LLM fit within its context window.
 *
 * @template T The type of items to chunk.
 * @param items - The array of items to be chunked.
 * @param getTokenCount - A function that returns the token count for a given item.
 * @param maxTokens - The maximum number of tokens allowed per chunk.
 * @returns An array of `DiffChunk` objects.
 */
export function chunkDiffs<T>(
  items: T[],
  getTokenCount: (item: T) => number,
  maxTokens: number = MAX_TOKENS_PER_CHUNK
): DiffChunk<T>[] {
  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentChunkTokens = 0;
  for (const item of items) {
    const itemTokens = getTokenCount(item);
    const wouldExceedLimit =
      currentChunk.length > 0 && currentChunkTokens + itemTokens > maxTokens;
    if (wouldExceedLimit) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkTokens = 0;
    }
    currentChunk.push(item);
    currentChunkTokens += itemTokens;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  const result: DiffChunk<T>[] = [];
  let chunkIndex = 0;
  for (const chunk of chunks) {
    result.push({
      chunkIndex,
      diffs: chunk,
      totalChunks: chunks.length,
    });
    chunkIndex++;
  }
  return result;
}
