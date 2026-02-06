import type { Context } from "hono";
import { expectError } from "@src/shared/lib/expect-error";
import { callAI } from "@src/features/pr/utils/call-model";
import { parseGitDiff, filterDiffForReview } from "@src/features/pr/utils/git-diff";
import { runSecurityEngine } from "@src/features/pr/utils/security-engine";
import { getPullRequestDiff, postPullRequestComment } from "@src/features/pr/utils/octokit";

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
    const installationId = installation.id;

    try {
        const diff = await getPullRequestDiff(installationId, owner, repo, pullRequest.number);
        const parsedDiff = parseGitDiff(diff);
        const filteredDiff = filterDiffForReview(parsedDiff);

        const securityFindings = runSecurityEngine(filteredDiff);

        const [aiError, aiReview] = filteredDiff.length > 0
            ? await expectError(callAI(filteredDiff, securityFindings))
            : [undefined, "No logic changes detected in the files of this pull request (ignored lockfiles or metadata)."];
        
        if (aiError) {
            console.error("AI analysis failed:", aiError);
            throw new Error("AI service unavailable");
        }

        if (!aiReview || aiReview.trim() === "" || aiReview.trim() === "No review summary generated.") {
            return c.text("OK, no comment to post.", 200);
        }

        await postPullRequestComment(installationId, owner, repo, pullRequest.number, aiReview);

        return c.text("OK", 200);

    } catch (error) {
        console.error("Error processing PR review:", error);
        return c.json({ error: "An error occurred while processing the review." }, 500);
    }
}
