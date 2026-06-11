import { checkDependencies } from "@src/features/pr/cve-detection";
import { filterDiff, parseGitDiff } from "@src/features/pr/git-diff";
import { callLLM } from "@src/features/pr/llm-call";
import { getPullRequestDiff, toComment } from "@src/features/pr/octokit";
import { runSecurityEngine } from "@src/features/pr/security-engine";
import { expectError } from "@src/shared/expect-error";

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
}) {
  const [diffError, rawDiff] = await expectError(
    getPullRequestDiff(token, owner, repo, prNumber)
  );
  if (diffError) {
    throw new Error("Failed to get pull request diff.");
  }

  const parsedDiff = parseGitDiff(rawDiff);

  const filteredDiff = filterDiff(parsedDiff);
  if (filteredDiff.length === 0) {
    return [];
  }

  // dependency vulnerability results
  const [dependencyError, dependencyScanResult] = await expectError(
    checkDependencies(filteredDiff)
  );
  if (dependencyError) {
    console.error("Failed to scan dependencies:", dependencyError);
  }
  const dependencyScan = dependencyScanResult ?? { reviews: [] };

  // Regex based security scan
  const securityScan = runSecurityEngine(filteredDiff);

  // LLM review
  const [LLMError, LLMReviewResult] = await expectError(
    callLLM(filteredDiff, securityScan, dependencyScan, apiKey)
  );
  if (LLMError) {
    console.error("Failed to call LLM:", LLMError);
  }
  const LLMReview = LLMReviewResult ?? { reviews: [] };

  // final PR comments
  return [
    ...dependencyScan.reviews.map(toComment),
    ...securityScan.reviews.map(toComment),
    ...LLMReview.reviews.map(toComment),
  ];
}
