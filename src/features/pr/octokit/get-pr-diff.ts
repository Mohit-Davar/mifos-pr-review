import { getOctokit } from "@actions/github";

/**
 * Fetches the raw text diff of a specific GitHub Pull Request.
 * @param token - The GitHub authentication token used to initialise Octokit.
 * @param owner - The owner/organisation of the target repository.
 * @param repo - The specific repository where the pull request lives.
 * @param pullNumber - The unique identifier of the target pull request.
 * @returns A promise that resolves to the raw diff data as a unified string.
 * @remarks
 * This function bypasses standard JSON responses by overriding the `accept` header
 * to specify `application/vnd.github.v3.diff`. Because Octokit's TypeScript types
 * expect JSON by default, the response is explicitly cast to a string.
 */
export async function getPullRequestDiff(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number
) {
  const octokit = getOctokit(token);
  const response = await octokit.rest.pulls.get({
    headers: { accept: "application/vnd.github.v3.diff" },
    owner,
    pull_number: pullNumber,
    repo,
  });
  return response.data as unknown as string;
}
