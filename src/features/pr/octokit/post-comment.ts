import { getOctokit } from "@actions/github";

export async function postReviewComment(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
  comments: { body: string; line: number; path: string }[]
) {
  if (comments.length === 0) return;

  const octokit = getOctokit(token);

  await octokit.rest.pulls.createReview({
    comments: comments.map((c) => ({
      body: c.body,
      line: c.line,
      path: c.path,
    })),
    event: "COMMENT",
    owner,
    pull_number: pullNumber,
    repo,
  });
}
