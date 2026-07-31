import type { PRContext } from "@src/features/push/octokit";
import {
  fetchDirectoryListing,
  isDirectoryPath,
  type RoutedDocument,
  RoutedDocumentsResponseSchema,
  SYSTEM_PROMPT,
} from "@src/features/push/select-documents";
import { callWithRetry, type DocumentConfig, expectError } from "@src/shared";

/**
 * Selects relevant documentation files to update based on the context of a pull request.
 *
 * For GitHub sources that point to a directory, this function pre-fetches the directory
 * listing (metadata only, no file content) and includes it in the LLM prompt. This allows
 * the LLM to route to specific file paths rather than folder paths, eliminating the need
 * for a second LLM call during retrieval.
 *
 * @param prContext - The context of the pull request.
 * @param sources - A list of all configured documentation sources.
 * @param docsGithubToken - GitHub token for reading documentation repositories.
 *   Required only when sources include GitHub directory paths.
 * @returns A promise that resolves to an array of `RoutedDocument` objects with specific
 *   file paths, representing the documents the LLM has determined need updates.
 * @throws An error if the LLM call fails.
 */
export async function selectDocuments(
  prContext: PRContext,
  sources: DocumentConfig[],
  docsGithubToken?: string
): Promise<RoutedDocument[]> {
  const enabledSources = sources.filter((source) => source.enabled !== false);
  if (enabledSources.length === 0) {
    return [];
  }

  // Pre-fetch directory listings for GitHub sources that point to a folder.
  const directoryListings = new Map<string, string[] | null>();
  await Promise.all(
    enabledSources.map(async (source) => {
      if (
        source.platform !== "confluence" &&
        docsGithubToken &&
        isDirectoryPath(source.path)
      ) {
        const files = await fetchDirectoryListing(source.path, docsGithubToken);
        directoryListings.set(source.path, files);
      }
    })
  );

  // Construct the user message with detailed context for the LLM.
  const userMessage = `
# Pull Request Context
## Title
${prContext.title}
## Description
${prContext.description || "(none)"}
## Commits
${prContext.commits.map((commit) => `- ${commit}`).join("\n") || "(none)"}
## Changed Files
${prContext.changedFiles.map((file) => `- ${file.path} (${file.status})`).join("\n") || "(none)"}
# Documentation Sources
Each source represents an independent documentation location that may need updating.
${enabledSources
  .map((source, index) => {
    const header = `
## Source ${index + 1}
Platform: ${source.platform}
${source.platform === "confluence" ? `Page ID: ${source.pageId}` : `Path: ${source.path}`}
Audience: ${source.audience}
Purpose: ${source.purpose ?? "(not specified)"}`;
    if (source.platform === "confluence") {
      return header;
    }
    const listing = directoryListings.get(source.path);
    if (listing === undefined) {
      // Not a directory path — it's a specific file already.
      return header;
    }
    if (listing === null || listing.length === 0) {
      return `${header}\nAvailable files: (could not be retrieved — skip this source if uncertain)`;
    }
    return `${header}\nAvailable files:\n${listing.map((f) => `  - ${f}`).join("\n")}`;
  })
  .join("\n")}
`.trim();

  const [error, result] = await expectError(
    callWithRetry(
      SYSTEM_PROMPT,
      userMessage,
      RoutedDocumentsResponseSchema,
      "routedDocuments"
    )
  );
  if (error) {
    throw new Error("Failed to route documentation sources.", { cause: error });
  }

  return result?.routedDocuments ?? [];
}
