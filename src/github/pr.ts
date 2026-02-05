import type {
  PullRequestOpenedEvent, PullRequestReopenedEvent, PullRequestSynchronizeEvent,
} from '@octokit/webhooks-types';

import { getOctokit } from '@src/github/app';

type PullRequestEvent =
    | PullRequestOpenedEvent
    | PullRequestSynchronizeEvent
    | PullRequestReopenedEvent;

export async function handlePullRequest(payload: PullRequestEvent) {
    const { pull_request, repository, installation } = payload;

    if (!installation) {
        throw new Error("Missing installation data");
    }

    const octokit = getOctokit(installation.id);

    const { data: files } = await octokit.pulls.listFiles({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: pull_request.number,
    });

    if (files.length === 0) return;

    let commentBody = "## PR Change Summary\n\n";
    commentBody += "| File | Status | Additions | Deletions |\n";
    commentBody += "| ---- | ------ | --------- | --------- |\n";

    for (const file of files) {
        commentBody += `| \`${file.filename}\` | ${file.status} | +${file.additions} | -${file.deletions} |\n`;
    }

    await octokit.issues.createComment({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: pull_request.number,
        body: commentBody,
    });
}
