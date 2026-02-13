import * as core from "@actions/core";
import * as github from "@actions/github";
import { handlePullRequest } from "@src/features/pr/handler";
import { postReviewComment } from "@src/features/pr/octokit";
import { expectError } from "@src/shared/lib/expect-error";

async function run() {
  const token = core.getInput("GITHUB_TOKEN");
  process.env["OPENAI_API_KEY"] = core.getInput("OPENAI_API_KEY");
  process.env["MODEL"] = core.getInput("MODEL");

  const { context } = github;
  if (context.eventName !== "pull_request")
    return core.info("This action only runs on pull request events.");

  const pr = context.payload.pull_request;
  if (!pr)
    return core.setFailed("No pull request found in the context.");

  const { owner, repo } = context.repo;
  const [prError, prResult] = await expectError(
    handlePullRequest({ token, owner, repo, prNumber: pr.number })
  );
  if (prError)
    return core.setFailed(prError.message);

  const { comments } = prResult;
  if (!comments.length)
    return core.info("No security issues found.");

  const [postError] = await expectError(
    postReviewComment(token, owner, repo, pr.number, comments)
  );
  if (postError)
    return core.setFailed(postError.message);
}

run();
