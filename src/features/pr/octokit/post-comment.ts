import { getOctokit } from "@actions/github";

export async function postReviewComment(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
  comments: { path: string; line: number; body: string }[]
) {
  if (comments.length === 0) return;

  const octokit = getOctokit(token);

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event: "COMMENT",
    comments: comments.map((c) => ({
      path: c.path,
      line: c.line,
      body: c.body,
    })),
  });
}
