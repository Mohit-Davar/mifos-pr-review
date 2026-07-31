import {
  type DocumentEdit,
  DocumentEditsSchema,
  SYSTEM_PROMPT,
} from "@src/features/push/generator";
import type { PRContext } from "@src/features/push/octokit";
import { callWithRetry, expectError } from "@src/shared";

/**
 * Generates document edits using an LLM based on PR context and current document content.
 * It constructs a prompt containing the PR details and the document's current state,
 * then calls the LLM to get a list of search-and-replace edits.
 *
 * @param prContext - The context of the pull request, including title, description, and diff.
 * @param currentContent - The current content of the documentation file to be updated.
 * @returns A promise that resolves to an array of `DocumentEdit` objects.
 * @throws An error if the LLM call fails.
 */
export async function generateDocumentEdits(
  prContext: PRContext,
  currentContent: string
): Promise<DocumentEdit[]> {
  const userMessage = `PR Context:
Title: ${prContext.title}
Description: ${prContext.description}
Commits:
${prContext.commits.map((c) => `- ${c}`).join("\n")}
Net Diff:
${prContext.diff}
Current Document Content:
\`\`\`
${currentContent}
\`\`\``;

  const [error, result] = await expectError(
    callWithRetry(
      SYSTEM_PROMPT,
      userMessage,
      DocumentEditsSchema,
      "documentEdits"
    )
  );
  if (error) {
    throw new Error("Failed to generate document edits using LLM", {
      cause: error,
    });
  }

  return result.edits;
}
