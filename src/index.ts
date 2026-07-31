import * as core from "@actions/core";
import * as github from "@actions/github";
import { handlePullRequest } from "@src/features/pr/handler";
import { handleMerge } from "@src/features/push/handler";
import { getPullRequestNumberFromCommit } from "@src/features/push/octokit/get-pr";
import { exitFailedAction, expectError } from "@src/shared";

async function run() {
  const token = core.getInput("github-token");
  const { context } = github;
  const { owner, repo } = context.repo;

  switch (context.eventName) {
    case "pull_request": {
      const pr = context.payload.pull_request;

      if (!pr) {
        core.setFailed("Pull request payload was not found.");
        return;
      }

      const [error] = await expectError(
        handlePullRequest({
          commitSha: pr["head"]["sha"],
          owner,
          prNumber: pr["number"],
          repo,
          token,
        })
      );

      if (error) {
        exitFailedAction("Pull request workflow failed", error);
      }

      break;
    }

    case "push": {
      const prNumber = await getPullRequestNumberFromCommit({
        commitSha: context.payload["after"],
        owner,
        repo,
        token,
      });

      if (!prNumber) {
        core.notice("No merged pull request found for this push.");
        return;
      }
      const [error] = await expectError(
        handleMerge({
          credentials: {
            confluence: {
              apiToken: core.getInput("confluence-api-token"),
              baseUrl: core.getInput("confluence-base-url"),
              username: core.getInput("confluence-username"),
            },
            docsGithubToken: core.getInput("docs-token"),
          },
          owner,
          prNumber,
          repo,
          token,
        })
      );

      if (error) {
        exitFailedAction("Documentation workflow failed", error);
      }

      break;
    }

    default:
      core.notice(`Unsupported event: "${context.eventName}".`);
  }
}

void run();
void run();
