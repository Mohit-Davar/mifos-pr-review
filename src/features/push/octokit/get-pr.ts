import { getOctokit } from "@actions/github";

export async function getPullRequestNumberFromCommit({
  commitSha,
  owner,
  repo,
  token,
}: {
  commitSha: string;
  owner: string;
  repo: string;
  token: string;
}): Promise<number | null> {
  const octokit = getOctokit(token);

  const { data } =
    await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      commit_sha: commitSha,
      owner,
      repo,
    });
  if (data.length === 0) {
    return null;
  }

  const pr = data.at(0);

  if (!pr) {
    return null;
  }

  return pr.number;
}
