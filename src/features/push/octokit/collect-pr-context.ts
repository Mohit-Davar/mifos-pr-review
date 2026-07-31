import { getOctokit } from "@actions/github";
import type { PRContext } from "@src/features/push/octokit";

/**
 * Collects comprehensive context for a given pull request.
 * This includes metadata (title, description, labels), commit messages, a list of changed files,
 * and the raw unified diff.
 *
 * @param params - The parameters for collecting PR context.
 * @param params.owner - The owner of the repository.
 * @param params.prNumber - The pull request number.
 * @param params.repo - The repository name.
 * @param params.token - The GitHub token for authentication.
 * @returns A promise that resolves to a `PRContext` object.
 */
export async function collectPRContext({
  owner,
  prNumber,
  repo,
  token,
}: {
  owner: string;
  prNumber: number;
  repo: string;
  token: string;
}): Promise<PRContext> {
  const octokit = getOctokit(token);

  // Fetch the pull request metadata.
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    pull_number: prNumber,
    repo,
  });
  const base = pr.base.sha;
  const head = pr.merge_commit_sha ?? pr.head.sha;
  const title = pr.title;
  const description = pr.body ?? "";
  const labels = pr.labels.map((label) => label.name);

  // Retrieve the list of commits and changed files between the base and head.
  const { data: comparison } = await octokit.rest.repos.compareCommits({
    base,
    head,
    owner,
    repo,
  });
  const commits = comparison.commits.map((commit) => commit.commit.message);
  const changedFiles = (comparison.files ?? []).map((file) => ({
    path: file.filename,
    status: file.status,
  }));

  // Fetch the unified diff for the same comparison.
  const { data: diff } = await octokit.rest.repos.compareCommits({
    base,
    head,
    headers: {
      accept: "application/vnd.github.diff",
    },
    owner,
    repo,
  });

  return {
    changedFiles,
    commits,
    description,
    diff: diff as unknown as string,
    labels,
    title,
  };
}
