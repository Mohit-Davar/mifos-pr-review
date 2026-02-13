import { filterDiff, parseGitDiff } from "@src/features/pr/git-diff";
import { callLLM } from "@src/features/pr/llm-call";
import { getPullRequestDiff, toComment } from "@src/features/pr/octokit";
import { runSecurityEngine } from "@src/features/pr/security-engine";

export async function handlePullRequest({
  token,
  owner,
  repo,
  prNumber,
}: {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
}) {
  const diff = await getPullRequestDiff(token, owner, repo, prNumber);

  const parsed = parseGitDiff(diff);
  const filtered = filterDiff(parsed);

  if (!filtered.length) {
    return {
      comments: [],
      message: "No relevant files changed."
    };
  }

  const regexFindings = runSecurityEngine(filtered);
  const llmFindings = await callLLM(filtered, regexFindings);

  const comments = [
    ...regexFindings.reviews.map(toComment),
    ...llmFindings.reviews.map(toComment),
  ];

  return { comments };
}
