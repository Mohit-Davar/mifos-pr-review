import * as core from "@actions/core";
import * as github from "@actions/github";
import { handlePullRequest } from "@src/features/pr/handler";
import { postReviewComment } from "@src/features/pr/octokit";
import { expectError } from "@src/shared";

async function run() {
  const token = core.getInput("GITHUB_TOKEN");
  const apiKey = core.getInput("OPENAI_API_KEY");

  const { context } = github;
  if (context.eventName !== "pull_request") {
    return core.info("This action only runs on pull request events.");
  }

  const pr = context.payload.pull_request;
  if (!pr) {
    return core.setFailed("No pull request found in the context.");
  }

  const { owner, repo } = context.repo;

  const [error, comments] = await expectError(
    handlePullRequest({
      apiKey,
      owner,
      prNumber: pr.number,
      repo,
      token,
    })
  );
  if (error) {
    return core.setFailed(error.message);
  }
  if (!comments.length) {
    return core.info("No security issues found.");
  }

  const [postError] = await expectError(
    postReviewComment(token, owner, repo, pr.number, comments)
  );
  if (postError) {
    return core.setFailed(postError.message);
  }
}

run();
