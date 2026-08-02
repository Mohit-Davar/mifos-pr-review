import {
  type DocumentEdit,
  DocumentEditsSchema,
  SYSTEM_PROMPT,
} from "@src/features/push/generator";
import { callWithRetry, expectError, type PRContext } from "@src/shared";

/**
 * Generates documentation edits using an LLM based on the pull request context
 * and the current document contents.
 *
 * The LLM returns a sequence of search-and-replace operations (or append
 * operations) that can be applied to the document.
 *
 * @param prContext - Pull request metadata and diff.
 * @param currentContent - Current document contents.
 * @returns A list of document edit operations.
 * @throws If the LLM request fails.
 */
export async function generateDocumentEdits(
  prContext: PRContext,
  currentContent: string
): Promise<DocumentEdit[]> {
  const userMessage = [
    "# Pull Request Context",
    `## Title\n${prContext.title}`,
    `## Description\n${prContext.description || "(none)"}`,
    `## Commits\n${
      prContext.commits.length
        ? prContext.commits.map((commit) => `- ${commit}`).join("\n")
        : "(none)"
    }`,
    `## Net Diff\n${prContext.diff}`,
    "## Current Document",
    "```",
    currentContent,
    "```",
  ].join("\n\n");

  const [error, result] = await expectError(
    callWithRetry(
      SYSTEM_PROMPT,
      userMessage,
      DocumentEditsSchema,
      "documentEdits"
    )
  );

  if (error || !result) {
    throw new Error("Failed to generate document edits using the LLM.", {
      cause: error,
    });
  }

  return result.edits;
}
