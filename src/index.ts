import * as core from "@actions/core";
import * as github from "@actions/github";
import { handlePullRequest } from "@src/features/pr/handler";
import { handleMerge } from "@src/features/push/handler";
import { exitFailedAction, expectError } from "@src/shared";

async function run() {
  const token = core.getInput("github-token");
  const { context } = github;
  const { owner, repo } = context.repo;

  if (context.eventName !== "pull_request") {
    core.notice(`Unsupported event: "${context.eventName}".`);
    return;
  }

  const pr = context.payload.pull_request;
  if (!pr) {
    core.setFailed("Pull request payload was not found.");
    return;
  }

  if (context.payload.action === "closed" && pr["merged"]) {
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
        prNumber: pr.number,
        repo,
        token,
      })
    );
    if (error) {
      exitFailedAction("Prowl documentation workflow failed", error);
    }
    return;
  } else {
    const [error] = await expectError(
      handlePullRequest({
        commitSha: pr["head"]["sha"],
        owner,
        prNumber: pr.number,
        repo,
        token,
      })
    );
    if (error) {
      exitFailedAction("Pull request workflow failed", error);
    }
  }
}

void run();
