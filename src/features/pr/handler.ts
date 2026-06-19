import * as core from "@actions/core";
import { checkVulnerabilities } from "@src/features/pr/cve-detection";
import { parseGitDiff } from "@src/features/pr/git-diff";
import { callLLM, LLMCallError } from "@src/features/pr/llm-call";
import {
  EMPTY_STATE,
  type FixedFinding,
  generateSummary,
  getPullRequestDiff,
  loadState,
  type MatchedFinding,
  matchFindings,
} from "@src/features/pr/octokit";
import { runSecurityEngine } from "@src/features/pr/security-engine";
import { expectError } from "@src/shared";

export interface HandlePullRequestResult {
  fixed: FixedFinding[];
  matched: MatchedFinding[];
  summary: string;
  summaryCommentId: number | null;
}

export async function handlePullRequest({
  apiKey,
  owner,
  prNumber,
  repo,
  token,
}: {
  apiKey: string;
  owner: string;
  prNumber: number;
  repo: string;
  token: string;
}): Promise<HandlePullRequestResult | null> {
  // Load previous state
  const [loadError, loadedState] = await expectError(
    loadState(token, owner, repo, prNumber)
  );
  const previousState = loadedState?.state ?? EMPTY_STATE;
  const summaryCommentId = loadedState?.summaryCommentId ?? null;
  if (loadError) {
    core.warning(`Failed to load previous state: ${loadError.message}`);
  }

  const [diffError, rawDiff] = await expectError(
    getPullRequestDiff(token, owner, repo, prNumber)
  );
  if (diffError) {
    throw new Error("Failed to fetch pull request diff.");
  }

  const parsedDiff = parseGitDiff(rawDiff);
  if (parsedDiff.length === 0) {
    return null;
  }

  const [dependencyError, dependencyScanResult] = await expectError(
    checkVulnerabilities(parsedDiff)
  );
  if (dependencyError) {
    core.warning("Dependency vulnerability scan failed.");
    core.debug(String(dependencyError));
  }
  const dependencyScan = dependencyScanResult ?? [];

  const securityScan = runSecurityEngine(parsedDiff);

  const [llmError, llmReviews] = await expectError(
    callLLM(parsedDiff, securityScan, dependencyScan, apiKey)
  );
  if (llmError) {
    if (llmError instanceof LLMCallError) {
      core.error(
        [
          "AI review encountered an unexpected error.",
          `Message: ${llmError.message}`,
          `Retryable: ${llmError.retryable}`,
          `Cause: ${
            llmError.cause instanceof Error
              ? (llmError.cause.stack ?? llmError.cause.message)
              : JSON.stringify(llmError.cause, null, 2)
          }`,
        ].join("\n")
      );
    } else {
      core.error(
        llmError instanceof Error
          ? (llmError.stack ?? llmError.message)
          : JSON.stringify(llmError, null, 2)
      );
    }
  }

  // Match current findings against previous state
  const { fixed, matched } = matchFindings(
    securityScan,
    dependencyScan,
    llmReviews ?? [],
    parsedDiff,
    previousState
  );

  const summary = generateSummary(matched, fixed);

  return {
    fixed,
    matched,
    summary,
    summaryCommentId,
  };
}
