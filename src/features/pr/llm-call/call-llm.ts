import {
  buildUserMessage,
  type Reviews,
  ReviewsSchema,
  SYSTEM_PROMPT,
} from "@src/features/pr/llm-call";
import type { PRContext } from "@src/features/pr/octokit";
import type { Findings } from "@src/features/pr/security-engine";
import {
  callWithRetry,
  chunkDiffs,
  type DiffChunk,
  expectError,
  MAX_CONCURRENT_CHUNKS,
  type ParsedFileDiff,
  tokenizer,
} from "@src/shared";
import pLimit from "p-limit";

/**
 * Groups findings by file into a map for efficient O(1) lookups.
 * @param findings - An array of findings from a security scanner.
 * @returns A map where keys are file paths and values are arrays of findings for that file.
 */
function createFindingsTable(findings: Findings[]): Map<string, Findings[]> {
  const findingsByFile = new Map<string, Findings[]>();

  for (const finding of findings) {
    const existingFindings = findingsByFile.get(finding.file) ?? [];
    existingFindings.push(finding);
    findingsByFile.set(finding.file, existingFindings);
  }

  return findingsByFile;
}

/**
 * Filters a findings table to return only the findings relevant to a specific diff chunk.
 * @param chunk - The diff chunk to get findings for.
 * @param findingsByFile - A map of findings grouped by file.
 * @returns An array of findings that are present in the files of the given chunk.
 */
function getRelevantChunkFindings(
  chunk: DiffChunk,
  findingsByFile: Map<string, Findings[]>
): Findings[] {
  const relevantFindings: Findings[] = [];
  for (const diff of chunk.diffs) {
    const fileFindings = findingsByFile.get(diff.file);
    if (!fileFindings) {
      continue;
    }
    relevantFindings.push(...fileFindings);
  }

  return relevantFindings;
}

/**
 * Calls the LLM to generate security reviews for a single chunk of a pull request diff.
 * @param chunk - The diff chunk to review.
 * @param securityFindingsByFile - A map of findings from the static security scanner.
 * @param cveFindingsByFile - A map of findings from the CVE scanner.
 * @param prContext - The context of the pull request.
 * @returns A promise that resolves to the parsed review object from the LLM.
 * @throws An error if the LLM call fails or the response cannot be parsed.
 */
async function reviewChunk(
  chunk: DiffChunk,
  securityFindingsByFile: Map<string, Findings[]>,
  cveFindingsByFile: Map<string, Findings[]>,
  prContext: PRContext
) {
  const message = buildUserMessage(
    chunk,
    getRelevantChunkFindings(chunk, securityFindingsByFile),
    getRelevantChunkFindings(chunk, cveFindingsByFile),
    prContext
  );

  const [error, result] = await expectError(
    callWithRetry(SYSTEM_PROMPT, message, ReviewsSchema, "reviews")
  );
  if (error) {
    throw new Error("Failed to generate AI review", {
      cause: error,
    });
  }

  return result;
}

/**
 * Removes duplicate findings that may appear when multiple chunks reference related code.
 * @param reviews - An array of `Reviews` generated from one or more diff chunks.
 * @returns A new array of `Reviews` with duplicates removed.
 */
function deduplicateReviews(reviews: Reviews): Reviews {
  const seen = new Set<string>();

  return reviews.filter((review) => {
    const key = `${review.file}:${review.line}:${review.problem}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Counts the number of tokens in a parsed file diff.
 * @param file - The parsed file diff to measure.
 * @returns The number of tokens in the diff.
 */
function countTokens(file: ParsedFileDiff): number {
  const formattedDiff = [
    `FILE ${file.file}`,
    ...file.changes.map(
      (change) => `${change.prefix}${change.lineNumber} ${change.content}`
    ),
  ].join("\n");

  return tokenizer.encode(formattedDiff).length;
}

/**
 * Orchestrates the process of calling the LLM to review pull request diffs.
 * @param diffs - An array of parsed file diffs.
 * @param securityFindings - An array of findings from the static security engine.
 * @param cveFindings - An array of findings from the CVE detection engine.
 * @param prContext - The context of the pull request (title, description, etc.).
 * @returns A promise that resolves to an array of `Reviews` from the LLM.
 */
export async function callLLM(
  diffs: ParsedFileDiff[],
  securityFindings: Findings[],
  cveFindings: Findings[],
  prContext: PRContext
): Promise<Reviews> {
  // Split large PRs into token-safe chunks.
  const diffChunks = chunkDiffs(diffs, countTokens);

  // Build file → findings lookup tables for efficient access.
  const securityFindingsByFile = createFindingsTable(securityFindings);
  const cveFindingsByFile = createFindingsTable(cveFindings);

  // Small PRs can be reviewed in a single request.
  if (diffChunks.length === 1) {
    const result = await reviewChunk(
      diffChunks[0]!,
      securityFindingsByFile,
      cveFindingsByFile,
      prContext
    );

    return result.reviews;
  }

  // Large PRs are processed concurrently with a limit to avoid overwhelming the LLM provider.
  const limit = pLimit(MAX_CONCURRENT_CHUNKS);
  const chunkResults = await Promise.all(
    diffChunks.map((chunk) =>
      limit(() =>
        reviewChunk(chunk, securityFindingsByFile, cveFindingsByFile, prContext)
      )
    )
  );
  const reviews = chunkResults.flatMap((result) => result.reviews);

  return deduplicateReviews(reviews);
}
