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
  const [diffError, diff] = await expectError(
    getPullRequestDiff(token, owner, repo, prNumber)
  );
  if (diffError) {
    throw new Error("Failed to get pull request diff.");
  }

  const parsedDiff = parseGitDiff(diff);
  const filteredDiff = filterDiff(parsedDiff);
  if (filteredDiff.length === 0) {
    return [];
  }

  const [dependencyError, dependencyFindings] = await expectError(
    checkDependencies(filteredDiff)
  );
  if (dependencyError) {
    console.error("Failed to check dependencies.");
  }

  const resolvedDependencyFindings = dependencyFindings || {
    reviews: [],
  };
  const securityFindings = runSecurityEngine(filteredDiff);

  const [llmError, llmFindings] = await expectError(
    callLLM(filteredDiff, securityFindings, resolvedDependencyFindings, apiKey)
  );
  if (llmError) {
    console.error("Failed to call LLM:", llmError);
  }

  const resolvedLlmFindings = llmFindings || {
    reviews: [],
  };

  return [
    ...resolvedDependencyFindings.reviews.map(toComment),
    ...securityFindings.reviews.map(toComment),
    ...resolvedLlmFindings.reviews.map(toComment),
  ];
}
