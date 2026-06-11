import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import { countFileTokens, type DiffChunk } from "@src/features/pr/llm-call";

const MAX_TOKENS_PER_CHUNK = 10000;

export function chunkDiffs(diffs: ParsedFileDiff[]): DiffChunk[] {
  const chunks: ParsedFileDiff[][] = [];
  let currentChunk: ParsedFileDiff[] = [];
  let currentTokens = 0;
  diffs.forEach((file) => {
    const fileTokens = countFileTokens(file);
    // Start a new chunk if this file would exceed the limit.
    if (
      currentTokens + fileTokens > MAX_TOKENS_PER_CHUNK &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokens = 0;
    }
    currentChunk.push(file);
    currentTokens += fileTokens;
  });

  // Add the final chunk.
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Include chunk metadata.
  return chunks.map((diffs, index) => ({
    chunkIndex: index,
    diffs,
    totalChunks: chunks.length,
  }));
}
