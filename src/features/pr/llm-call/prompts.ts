import type { PRContext } from "@src/features/pr/octokit";
import type { Findings } from "@src/features/pr/security-engine";
import type { DiffChunk, ParsedFileDiff } from "@src/shared";

/**
 * The system prompt that instructs the LLM on how to perform the security review.
 * It sets the persona, rules, and output requirements for the model.
 */
export const SYSTEM_PROMPT = `
Expert Application Security reviewer.

Review ONLY added code from the diff.

Report ONLY:
- Real vulnerabilities introduced by the diff
- Verified dependency vulnerabilities
- Valid security scanner findings

Do NOT report:
- Style issues
- Code quality issues without security impact
- Best practices
- Speculation
- Potential issues without evidence
- False positives

Focus on:
SQL Injection, Command Injection, XSS, SSRF, Path Traversal,
LDAP Injection, Template Injection, Unsafe Deserialization,
Authentication flaws, Authorization flaws, IDOR,
Privilege Escalation, Session Management flaws,
Sensitive Data Exposure, Cryptography misuse,
Business Logic vulnerabilities, Vulnerable Dependencies.

Requirements:
- Use exact added diff line numbers.
- Base findings only on evidence visible in the diff.
- Do not assume protections or missing protections.
- If exploitation cannot be reasonably inferred, do not report.
- Prefer false negatives over false positives.

Use technical English.
Be direct, precise, and actionable.
`;

/**
 * Formats a single parsed file diff into a plain text block for the LLM.
 * @param fileDiff - The parsed file diff to format.
 * @returns A string representation of the file diff.
 * @example
 * FILE src/auth/login.ts
 *  10 const user = getUser();
 * +11 const query = `SELECT * FROM users WHERE id=${id}`;
 * -11 const query = db.prepare(...);
 *  12 return user;
 */
function formatFileDiff(fileDiff: ParsedFileDiff): string {
  const body = fileDiff.changes
    .map((line) => `${line.prefix}${line.lineNumber} ${line.content}`)
    .join("\n");
  return `FILE ${fileDiff.file}\n${body}`;
}

/**
 * Formats an array of findings from a security scanner into a plain text block.
 * @param label - The label for the findings section (e.g., "SECURITY_SCAN").
 * @param findings - The array of findings to format.
 * @returns A string representation of the findings.
 * @example
 * SECURITY_SCAN
 * path/to/file.ts:123 medium Input validation missing...
 */
function formatFindings(label: string, findings: Findings[]): string {
  if (findings.length === 0) {
    return `${label}: none`;
  }
  const lines: string[] = [];
  findings.forEach((finding) => {
    lines.push(
      `${finding.file}:${finding.line} ${finding.severity} ${finding.description}`
    );
  });
  return `${label}\n${lines.join("\n")}`;
}

/**
 * Formats the pull request context (title, description, etc.) into a plain text block.
 * @param ctx - The PR context object.
 * @returns A string representation of the PR context.
 */
function formatPRContext(ctx: PRContext): string {
  const lines: string[] = [];
  lines.push(`PR TITLE: ${ctx.title}`);
  if (ctx.description) {
    lines.push(`PR DESCRIPTION:\n${ctx.description}`);
  }
  if (ctx.commitMessages.length > 0) {
    lines.push(
      `COMMIT MESSAGES:\n${ctx.commitMessages.map((m) => `- ${m}`).join("\n")}`
    );
  }
  if (ctx.linkedIssues.length > 0) {
    lines.push(
      `LINKED ISSUES:\n${ctx.linkedIssues
        .map((i) => `- #${i.number}: ${i.title}`)
        .join("\n")}`
    );
  }
  return lines.join("\n\n");
}

/**
 * Builds the complete user message to be sent to the LLM for a review chunk.
 *
 * @param chunk - The diff chunk to be reviewed.
 * @param securityFindings - Findings from the static security scanner relevant to this chunk.
 * @param cveFindings - Findings from the CVE scanner relevant to this chunk.
 * @param prContext - The context of the pull request.
 * @returns The complete, formatted user message string.
 *
 * @remarks
 * This function assembles the PR context, the formatted diffs, and the findings from
 * various scanners into a single message that provides the LLM with all the necessary
 * information to perform its review.
 */
export function buildUserMessage(
  chunk: DiffChunk,
  securityFindings: Findings[],
  cveFindings: Findings[],
  prContext: PRContext
): string {
  const parts: string[] = [];
  if (chunk.totalChunks > 1) {
    parts.push(`Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
  }

  parts.push(formatPRContext(prContext));
  parts.push(chunk.diffs.map(formatFileDiff).join("\n\n"));
  parts.push(formatFindings("SECURITY_SCAN", securityFindings));
  parts.push(formatFindings("CVE_SCAN", cveFindings));

  return parts.join("\n\n");
}
