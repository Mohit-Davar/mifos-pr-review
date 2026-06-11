import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import { chunkDiffs } from "@src/features/pr/llm-call/chunker";
import { buildUserMessage } from "@src/features/pr/llm-call/prompts";
import type {
  DiffChunk,
  Review,
  Reviews,
} from "@src/features/pr/llm-call/types";
import { getConfig } from "@src/shared/config";
import { createLLMClient } from "@src/shared/model";
import pLimit from "p-limit";

import { callWithRetry } from "./retry-call";

const MAX_CONCURRENT_CHUNKS = 3;

// Build file -> findings lookup table
function createFindingsIndex(findings: Reviews): Map<string, Review[]> {
  const index = new Map<string, Review[]>();

  findings.reviews.forEach((review) => {
    const existing = index.get(review.file);

    if (existing) {
      existing.push(review);
      return;
    }

    index.set(review.file, [review]);
  });

  return index;
}

// Get only findings relevant to files in this chunk
function getChunkFindings(
  chunk: DiffChunk,
  findingsIndex: Map<string, Review[]>
): Reviews {
  const reviews: Review[] = [];

  chunk.diffs.forEach((diff) => {
    const fileReviews = findingsIndex.get(diff.file);

    if (!fileReviews) {
      return;
    }

    reviews.push(...fileReviews);
  });

  return { reviews };
}

/**
 * Removes duplicate reviews that may appear when the same file
 * is referenced across chunk boundaries.
 */
function deduplicateReviews(reviews: Reviews["reviews"]): Reviews["reviews"] {
  const seen = new Set<string>();

  return reviews.filter((review) => {
    const key = `${review.file}:${review.line}:${review.comment}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function callLLM(
  diffs: ParsedFileDiff[],
  securityFindings: Reviews,
  cveFindings: Reviews,
  apiKey: string
): Promise<Reviews> {
  const openai = createLLMClient(apiKey);
  const config = getConfig();
  const model = config.model || "gpt-5-nano";

  // Split diff into chunks
  const chunks = chunkDiffs(diffs);

  // Build lookup tables once
  const securityIndex = createFindingsIndex(securityFindings);
  const cveIndex = createFindingsIndex(cveFindings);

  // Single chunk
  if (chunks.length === 1) {
    const message = buildUserMessage(
      chunks[0]!,
      getChunkFindings(chunks[0]!, securityIndex),
      getChunkFindings(chunks[0]!, cveIndex)
    );

    return callWithRetry(openai, model, message);
  }

  console.log(
    `Large PR detected — splitting into ${chunks.length} chunks (max ${MAX_CONCURRENT_CHUNKS} concurrent)`
  );

  const limit = pLimit(MAX_CONCURRENT_CHUNKS);

  const results = await Promise.all(
    chunks.map((chunk) =>
      limit(async () => {
        const message = buildUserMessage(
          chunk,
          getChunkFindings(chunk, securityIndex),
          getChunkFindings(chunk, cveIndex)
        );

        return callWithRetry(openai, model, message);
      })
    )
  );

  const allReviews = results.flatMap((result) => result.reviews);

  return {
    reviews: deduplicateReviews(allReviews),
  };
}
