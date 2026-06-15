import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import type { DiffChunk, Reviews } from "@src/features/pr/llm-call";

// Security review instructions
export const SYSTEM_PROMPT = `
You are an expert Application Security reviewer performing a pull request security review.

Your goals:
1. Find real security vulnerabilities introduced in the added code.
2. Validate findings from automated security scanners.
3. Ignore false positives.
4. Identify vulnerable dependencies when evidence exists.

Focus:
- SQL Injection
- Command Injection
- XSS
- SSRF
- Path Traversal
- LDAP Injection
- Template Injection
- Unsafe Deserialization
- Authentication flaws
- Authorization flaws (IDOR, privilege escalation)
- Session management issues
- Sensitive data exposure
- Cryptographic misuse
- Business logic vulnerabilities
- Dependency vulnerabilities

Rules:
- Use the exact added diff line number.
- Do not speculate.
- Do not assume external context.
- If exploitation cannot be reasonably inferred from the diff, do not report it.
- Prefer false negatives over false positives.
- Only report findings with clear evidence.

Severity guidelines:
- high: Exploitable vulnerability that may lead to unauthorised access, remote code execution, data exposure, privilege escalation, authentication bypass, or major security compromise.
- medium: Security weakness with realistic impact but requiring additional conditions or limited attacker control.
- low: Defense-in-depth issue or security weakness with limited impact.

For every finding:
- Explain the vulnerability.
- Explain why it is risky.
- Provide a concrete remediation.
- Provide a prompt to another AI to fix this vulnerability.

Return ONLY valid JSON.

Schema:
{
  "reviews": [
    {
      "file": "path/to/file",
      "line": 42,
      "severity": "high|medium|low",
      "problem": "Description of the vulnerability and why it is risky",
      "solution": "Concrete remediation steps",
      "prompt": "Give a prompt to another AI to fix this vulnerability"
    }
  ]
}

If no valid security findings exist:

{"reviews":[]}
`;

// Format a single file diff
// Output:
// FILE src/auth/login.ts
//  10 const user = getUser();
// +11 const query = `SELECT * FROM users WHERE id=${id}`;
// -11 const query = db.prepare(...);
//  12 return user;
function formatFileDiff(fileDiff: ParsedFileDiff): string {
  const body = fileDiff.changes
    .map((line) => `${line.prefix}${line.lineNumber} ${line.content}`)
    .join("\n");

  return `FILE ${fileDiff.file}\n${body}`;
}

// Format existing findings
// Output:
// Regex Scan:
// path/to/file.ts:123 medium Input validation missing for user-provided parameter 'id' in SQL query.
// path/to/another/file.ts:45 high Unsanitised user input in 'comment' field could lead to XSS.
function formatFindings(label: string, findings: Reviews): string {
  if (findings.reviews.length === 0) {
    return `${label}: none`;
  }
  const lines: string[] = [];
  findings.reviews.forEach((review) => {
    lines.push(
      `${review.file}:${review.line} ${review.severity} ${review.problem}`
    );
  });

  return `${label}\n${lines.join("\n")}`;
}

// Build LLM message
export function buildUserMessage(
  chunk: DiffChunk,
  securityFindings: Reviews,
  cveFindings: Reviews
): string {
  const parts: string[] = [];

  if (chunk.totalChunks > 1) {
    parts.push(`Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
  }

  parts.push(chunk.diffs.map(formatFileDiff).join("\n\n"));

  parts.push(formatFindings("SECURITY_SCAN", securityFindings));

  parts.push(formatFindings("CVE_SCAN", cveFindings));

  return parts.join("\n\n");
}
