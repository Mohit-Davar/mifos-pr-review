import { getOctokit } from "@actions/github";
import type { LinkedIssue, PRContext } from "@src/shared/github/types";

/**
 * Strips common markdown syntax from a string to produce plain text.
 * This is used to reduce token count and remove noise for the LLM.
 * @param text - The raw markdown text.
 * @returns The text with markdown formatting removed.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "") // headings
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → link text
    .replace(/`{1,3}[^`]*`{1,3}/g, "") // inline code / code fences
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1") // bold / italic
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/^\s*[-*+>]\s+/gm, "") // list items / blockquotes
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts GitHub issue numbers from a block of text.
 * It looks for GitHub's closing keywords (e.g., "closes #42") as well as bare issue numbers.
 * @param text - The text to search for issue numbers (e.g., PR body, commit messages).
 * @returns A deduplicated array of issue numbers.
 */
export function extractIssueNumbers(text: string): number[] {
  const pattern = /(?:closes?|fixes?|resolves?)\s+#(\d+)|(?<!\w)#(\d+)/gi;
  const seen = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const num = parseInt(match[1] ?? match[2] ?? "", 10);
    if (!isNaN(num)) seen.add(num);
  }
  return [...seen];
}

/**
 * Fetches and compiles standard, comprehensive context for a given Pull Request.
 *
 * @param params - Target repository and credentials parameters.
 * @returns A promise resolving to the fully loaded standard PR context.
 */
export async function getPRContext({
  owner,
  prNumber,
  repo,
  token,
}: {
  owner: string;
  prNumber: number;
  repo: string;
  token: string;
}): Promise<PRContext> {
  const octokit = getOctokit(token);

  // Fetch PR metadata, diff, commits, and changed files in parallel
  const [prRes, diffRes, commitsRes, filesRes] = await Promise.all([
    // Fetch Pull Request details
    octokit.rest.pulls.get({
      owner,
      pull_number: prNumber,
      repo,
    }),
    // Fetch raw unified diff
    octokit.rest.pulls.get({
      headers: { accept: "application/vnd.github.v3.diff" },
      owner,
      pull_number: prNumber,
      repo,
    }),
    // Fetch commits
    octokit.rest.pulls.listCommits({
      owner,
      per_page: 100,
      pull_number: prNumber,
      repo,
    }),
    // Fetch changed files
    octokit.rest.pulls.listFiles({
      owner,
      per_page: 100,
      pull_number: prNumber,
      repo,
    }),
  ]);

  const pr = prRes.data;
  const title = pr.title;
  const description = pr.body ?? "";
  const strippedDescription = stripMarkdown(description);
  const labels = pr.labels.map((label) => label.name);
  const diff = diffRes.data as unknown as string;

  // Process commits: get full messages and first-line subjects
  const commits = commitsRes.data.map((c) => c.commit.message);
  const commitMessages = commitsRes.data.map(
    (c) => c.commit.message.split("\n")[0]!
  );

  // Process files
  const changedFiles = filesRes.data.map((file) => ({
    path: file.filename,
    status: file.status,
  }));

  // Extract linked issues from body and commits
  const allText = [description, ...commits].join("\n");
  const issueNumbers = extractIssueNumbers(allText);

  // Resolve titles for linked issues in parallel
  const linkedIssues: LinkedIssue[] = [];
  await Promise.all(
    issueNumbers.map(async (num) => {
      try {
        const { data: issue } = await octokit.rest.issues.get({
          issue_number: num,
          owner,
          repo,
        });
        linkedIssues.push({ number: num, title: issue.title });
      } catch {
        // Issue may not exist or may be from another repo thus skip silently
      }
    })
  );

  // Deterministically sort by issue number
  linkedIssues.sort((a, b) => a.number - b.number);

  return {
    changedFiles,
    commitMessages,
    commits,
    description,
    diff,
    labels,
    linkedIssues,
    strippedDescription,
    title,
  };
}
