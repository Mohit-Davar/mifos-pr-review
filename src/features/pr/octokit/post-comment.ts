import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import {
  encodeState,
  findingToComment,
  type FixedFinding,
  type MatchedFinding,
  type PersistedFinding,
  type PersistedState,
  SUMMARY_MARKER,
  toComment,
} from "@src/features/pr/octokit";

const RESOLVED_PREFIX =
  "> ~~**Resolved** — this issue was fixed in a later commit.~~\n\n---\n\n";

export async function postReviewComment(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number,
  commitSha: string,
  matched: MatchedFinding[],
  fixed: FixedFinding[],
  summary: string,
  summaryCommentId: number | null
): Promise<void> {
  const octokit = getOctokit(token);
  const newFindings: PersistedFinding[] = [];

  // Keep existing comment IDs for findings that are still present.
  for (const m of matched) {
    if (m.status !== "active" || !m.previous) {
      continue;
    }

    // Keep the latest file and line information.
    let file: string;
    let line: number;
    if (m.source === "llm") {
      file = m.review.file;
      line = m.review.line;
    } else {
      file = m.finding.file;
      line = m.finding.line;
    }

    newFindings.push({ ...m.previous, file, line });
  }

  // Create review comments for newly detected findings.
  for (const m of matched) {
    if (m.status !== "new") {
      continue;
    }

    let payload:
      | ReturnType<typeof toComment>
      | ReturnType<typeof findingToComment>;
    let severity: PersistedFinding["severity"];
    if (m.source === "llm") {
      payload = toComment(m.review);
      severity = m.review.severity;
    } else {
      payload = findingToComment(m.finding, m.source);
      severity = m.finding.severity;
    }

    try {
      const { data: comment } = await octokit.rest.pulls.createReviewComment({
        body: payload.body,
        commit_id: commitSha,
        line: payload.line,
        owner,
        path: payload.path,
        pull_number: pullNumber,
        repo,
        side: "RIGHT",
      });
      newFindings.push({
        commentId: comment.id,
        file: payload.path,
        fingerprint: m.fingerprint,
        line: payload.line,
        severity,
        source: m.source,
      });
    } catch (err) {
      core.warning(
        `Failed to post comment for ${payload.path}:${payload.line} — ${String(err)}`
      );
    }
  }

  // Mark findings that no longer exist as resolved.
  for (const f of fixed) {
    try {
      const { data: existing } = await octokit.rest.pulls.getReviewComment({
        comment_id: f.previous.commentId,
        owner,
        repo,
      });

      // Avoid updating a comment that was already marked as resolved.
      if (existing.body.startsWith(RESOLVED_PREFIX)) {
        continue;
      }

      await octokit.rest.pulls.updateReviewComment({
        body: RESOLVED_PREFIX + existing.body,
        comment_id: f.previous.commentId,
        owner,
        repo,
      });
    } catch (err) {
      core.warning(
        `Failed to resolve comment ${f.previous.commentId} — ${String(err)}`
      );
    }
  }

  // Persist the latest finding state in the summary comment.
  const newState: PersistedState = { findings: newFindings, version: 1 };
  const summaryBody = `${SUMMARY_MARKER}\n\n${summary}${encodeState(newState)}`;

  try {
    if (summaryCommentId === null) {
      await octokit.rest.issues.createComment({
        body: summaryBody,
        issue_number: pullNumber,
        owner,
        repo,
      });
    } else {
      await octokit.rest.issues.updateComment({
        body: summaryBody,
        comment_id: summaryCommentId,
        owner,
        repo,
      });
    }
  } catch (err) {
    core.error(`Failed to upsert summary comment — ${String(err)}`);
    throw err;
  }
}
