import type { Context } from "hono";
import { getOctokit } from "@src/shared/lib/github-client";
import { expectError } from "@src/shared/lib/expect-error";
import { callAI } from "@src/features/pr/utils/call-model";
import { parseGitDiff } from "@src/features/pr/utils/diff-parser";

const VALID_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

export async function handleReview(c: Context) {
    const event = c.req.header("X-GitHub-Event");
    if (event !== "pull_request") return c.text("Event ignored", 200);

    const payload = await c.req.json();
    const { action, repository, pull_request: pullRequest, installation } = payload;

    if (!VALID_ACTIONS.has(action))
        return c.text("Event ignored", 200);
    if (!repository || !pullRequest || !installation)
        return c.text("Missing payload data", 400);

    const { owner: { login: owner }, name: repo } = repository;
    const octokit = getOctokit(installation.id);
    const [diffError, diffRes] = await expectError(
        octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: pullRequest.number,
            headers: { accept: "application/vnd.github.v3.diff" },
        })
    );
    if (diffError) {
        console.error("Failed to fetch diff:", diffError);
        return c.text("Error fetching diff", 500);
    }

    const parsedDiff = parseGitDiff(diffRes.data as unknown as string);
    const filteredDiff = parsedDiff.filter(file => {
        const ignoredExtensions = ['.lock', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
        return !ignoredExtensions.some(ext => file.file.endsWith(ext));
    });

    const [aiError, review] = filteredDiff.length > 0
        ? await expectError(callAI(filteredDiff))
        : [undefined, "No logic changes detected in the files of this pull request (ignored lockfiles or metadata)."];
    if (aiError) {
        console.error("AI analysis failed:", aiError);
        return c.json({ error: "AI service unavailable" }, 500);
    }

    const [commentError] = await expectError(
        octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: pullRequest.number,
            body: review,
        })
    );
    if (commentError) {
        console.error("Failed to post GitHub comment:", commentError);
        return c.json({ error: "GitHub API error" }, 500);
    }

    return c.text("OK", 200);
}
