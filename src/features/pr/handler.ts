import * as core from "@actions/core";
import { matchFindings } from "@src/features/pr/compare-state";
import { checkVulnerabilities } from "@src/features/pr/cve-detection";
import { parseGitDiff } from "@src/features/pr/git-diff";
import { callLLM } from "@src/features/pr/llm-call";
import {
  generateSummary,
  getGitHubContext,
  getPullRequestDiff,
  loadState,
  postReviewComment,
} from "@src/features/pr/octokit";
import { runSecurityEngine } from "@src/features/pr/security-engine";
import { expectError } from "@src/shared";

/**
 * The main handler for the pull request review process.
 * This function orchestrates the entire workflow, from fetching data to posting results.
 *
 * @param params - The parameters required to process the pull request.
 * @param params.commitSha - The SHA of the latest commit in the PR.
 * @param params.owner - The owner of the repository.
 * @param params.prNumber - The pull request number.
 * @param params.repo - The name of the repository.
 * @param params.token - The GitHub token for authentication.
 *
 * @remarks
 * The workflow is as follows:
 * **Load State**: Load findings from the previous run from the summary comment.
 * **Fetch Data**: Get the raw PR diff and other context (title, description, etc.).
 * **Parse Diff**: Convert the raw diff into a structured format.
 * **Run Scanners**:
 *  - `checkVulnerabilities`: Scan for vulnerabilities in new dependencies.
 *  - `runSecurityEngine`: Run static analysis rules for secrets and unsafe patterns.
 *  - `callLLM`: Send the diff and scanner results to an LLM for deeper analysis.
 * **Match Findings**: Correlate findings from the current run with the previous run to identify new, active, and fixed issues.
 * **Generate Summary**: Create a markdown summary of all findings.
 * **Post Comments**: Publish the summary and individual review comments to the PR.
 */
export async function handlePullRequest({
  commitSha,
  owner,
  prNumber,
  repo,
  token,
}: {
  commitSha: string;
  owner: string;
  prNumber: number;
  repo: string;
  token: string;
}) {
  // Load findings from the previous run to track changes.
  const [loadStateError, loadedState] = await expectError(
    loadState(token, owner, repo, prNumber)
  );
  if (loadStateError) {
    throw new Error("Failed to load previous state from summary", {
      cause: loadStateError,
    });
  }

  // Fetch the raw git diff.
  const [diffError, rawDiff] = await expectError(
    getPullRequestDiff(token, owner, repo, prNumber)
  );
  if (diffError) {
    throw new Error("Failed to fetch raw git diff from GitHub API", {
      cause: diffError,
    });
  }

  // Fetch additional context using PR and Issues from GitHub
  const [contextError, prContext] = await expectError(
    getGitHubContext(token, owner, repo, prNumber)
  );
  if (contextError) {
    throw new Error("Failed to fetch PR context from GitHub API", {
      cause: contextError,
    });
  }

  // Convert the git diff into a structured format.
  const parsedGitDiff = parseGitDiff(rawDiff);
  if (parsedGitDiff.length === 0) {
    core.info("No file changes detected in PR. Skipping analysis.");
    return;
  }

  // Look for vulnerabilities in newly added dependencies
  const [dependencyError, dependencyScan] = await expectError(
    checkVulnerabilities(parsedGitDiff)
  );
  if (dependencyError) {
    core.warning(
      `Dependency vulnerability scan failed: ${dependencyError.message}`
    );
  }

  // Run static analysis on the code diff
  const securityScan = runSecurityEngine(parsedGitDiff);

  // Get AI review for the changes
  const [llmError, llmReviews] = await expectError(
    callLLM(parsedGitDiff, securityScan, dependencyScan ?? [], prContext)
  );
  if (llmError) {
    throw new Error("LLM review failed", {
      cause: llmError,
    });
  }

  // Compare current findings against the previous run.
  const { fixed, matched } = matchFindings(
    securityScan,
    dependencyScan ?? [],
    llmReviews,
    parsedGitDiff,
    loadedState.state
  );
  if (matched.length === 0 && fixed.length === 0) {
    core.info("No new, active, or fixed findings to report.");
    return;
  }

  // Build the PR summary comment.
  const summary = generateSummary(matched, fixed);

  // Post the summary and any new individual review comments to the PR.
  const [postError] = await expectError(
    postReviewComment(
      token,
      owner,
      repo,
      prNumber,
      commitSha,
      matched,
      fixed,
      summary,
      loadedState.summaryCommentId
    )
  );
  if (postError) {
    throw new Error("Failed to publish review comments", {
      cause: postError,
    });
  }
}
