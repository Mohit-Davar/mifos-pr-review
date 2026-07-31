import { getOctokit } from "@actions/github";
import type { PRContext } from "@src/features/pr/octokit";

/**
 * Strips common markdown syntax from a string to produce plain text.
 * This is used to reduce token count and remove noise for the LLM.
 * @param text - The raw markdown text.
 * @returns The text with markdown formatting removed.
 */
function stripMarkdown(text: string): string {
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
function extractIssueNumbers(text: string): number[] {
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
 * Fetches and processes the context of a pull request, including its title,
 * description, commit messages, and linked issues.
 *
 * @param token - The GitHub token.
 * @param owner - The repository owner.
 * @param repo - The repository name.
 * @param pullNumber - The pull request number.
 * @returns A promise that resolves to a `PRContext` object.
 */
export async function getGitHubContext(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRContext> {
  const octokit = getOctokit(token);
  // Fetch PR metadata.
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    pull_number: pullNumber,
    repo,
  });
  const title = pr.title;
  const description = stripMarkdown(pr.body ?? "");

  // Fetch all commit messages for this PR.
  const { data: commits } = await octokit.rest.pulls.listCommits({
    owner,
    per_page: 100,
    pull_number: pullNumber,
    repo,
  });
  const commitMessages = commits.map((c) => c.commit.message.split("\n")[0]!);

  // Extract issue numbers from PR body + all commit messages.
  const allText = [pr.body ?? "", ...commits.map((c) => c.commit.message)].join(
    "\n"
  );
  const issueNumbers = extractIssueNumbers(allText);

  // Fetch each issue title individually.
  const linkedIssues: { number: number; title: string }[] = [];
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
        // Issue may not exist or may be from another repo — skip silently.
      }
    })
  );

  // Sort by issue number for deterministic ordering.
  linkedIssues.sort((a, b) => a.number - b.number);

  return { commitMessages, description, linkedIssues, title };
}
