import { getOctokit } from "@src/shared/lib/github-client";
import { expectError } from "@src/shared/lib/expect-error";

export async function getPullRequestDiff(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number
): Promise<string> {
    const octokit = getOctokit(installationId);
    const [diffError, diffRes] = await expectError(
        octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
            headers: { accept: "application/vnd.github.v3.diff" },
        })
    );

    if (diffError) {
        console.error("Failed to fetch diff:", diffError);
        throw new Error("Error fetching diff");
    }

    return diffRes.data as unknown as string;
}

export async function postPullRequestComment(
    installationId: number,
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
) {
    const octokit = getOctokit(installationId);
    const [commentError] = await expectError(
        octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body: body,
        })
    );

    if (commentError) {
        console.error("Failed to post GitHub comment:", commentError);
        throw new Error("GitHub API error");
    }
}
