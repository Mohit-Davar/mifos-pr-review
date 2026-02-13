import { getOctokit } from "@actions/github";

export async function getPullRequestDiff(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const octokit = getOctokit(token);
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    headers: { accept: "application/vnd.github.v3.diff" },
  });
  return response.data as unknown as string;
}
