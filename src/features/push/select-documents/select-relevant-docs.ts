import {
  fetchDirectoryListing,
  fetchSpaceListing,
  isDirectoryPath,
  type RoutedDocument,
  RoutedDocumentsResponseSchema,
  SYSTEM_PROMPT,
} from "@src/features/push/select-documents";
import {
  callWithRetry,
  type DocumentConfig,
  expectError,
  type PlatformCredentials,
} from "@src/shared";
import type { PRContext } from "@src/shared/github";

/**
 * Builds the composite GitHub path `/owner/repo/path` for a GitHub-backed
 * documentation source using the required `repo` (`owner/repo`) and `path` fields.
 */
function resolveGitHubPath(repo: string, sourcePath: string): string {
  const cleanPath = sourcePath.replace(/^\/+/, "");
  return `/${repo}/${cleanPath}`;
}

/**
 * Selects relevant documentation files to update based on the context of a pull request.
 *
 * For GitHub sources that point to a directory, this function pre-fetches the directory
 * listing (metadata only, no file content) and includes it in the LLM prompt. This allows
 * the LLM to route to specific file paths rather than folder paths, eliminating the need
 * for a second LLM call during retrieval.
 *
 * Directory listings are cached in `.mifoshawk/directory-cache.json` in the workspace
 * and can survive across GitHub Action runs when the file is restored via `actions/cache`.
 *
 * @param prContext - The context of the pull request.
 * @param sources - A list of all configured documentation sources.
 * @param credentials - Credentials for accessing documentation platforms.
 * @returns A promise that resolves to an array of `RoutedDocument` objects with specific
 *   file paths, representing the documents the LLM has determined need updates.
 * @throws An error if the LLM call fails.
 */
export async function selectDocuments(
  prContext: PRContext,
  sources: DocumentConfig[],
  credentials: PlatformCredentials
): Promise<RoutedDocument[]> {
  const enabledSources = sources.filter((source) => source.enabled !== false);

  if (enabledSources.length === 0) {
    return [];
  }

  const { docsGithubToken } = credentials;
  const directoryListings = new Map<string, string[] | null>();
  const spaceListings = new Map<string, string[] | null>();

  // Pre-fetch directory listings for GitHub directories and page listings for Confluence spaces.
  await Promise.all(
    enabledSources.map(async (source) => {
      if (source.platform === "confluence") {
        if (!source.spaceKey || !credentials.confluence) {
          return;
        }
        const pages = await fetchSpaceListing(
          source.spaceKey,
          credentials.confluence
        );
        spaceListings.set(source.spaceKey, pages);
        return;
      } else if (
        source.platform === "gitbook" ||
        source.platform === "readme"
      ) {
        if (!docsGithubToken) {
          return;
        }
        const compositePath = resolveGitHubPath(source.repo, source.path);
        if (!isDirectoryPath(compositePath)) {
          return;
        }
        const files = await fetchDirectoryListing(
          compositePath,
          docsGithubToken,
          source.branch
        );
        directoryListings.set(compositePath, files);
      }
    })
  );

  // Build documentation sources prompt section.
  const renderedSources = enabledSources
    .map((source, index) => {
      const sourceNumber = index + 1;
      if (source.platform === "confluence") {
        const header = [
          `## Source ${sourceNumber}`,
          `Platform: ${source.platform}`,
          `Audience: ${source.audience}`,
          `Purpose: ${source.purpose ?? "(not specified)"}`,
        ];
        // Single page source.
        if (!source.spaceKey) {
          header.push(`Page ID: ${source.pageId}`);
          return header.join("\n");
        }
        // Space source.
        header.push(`Space Key: ${source.spaceKey}`);
        const pages = spaceListings.get(source.spaceKey);
        const renderedHeader = header.join("\n");
        if (pages == null) {
          return `${renderedHeader}\nAvailable pages: (could not be retrieved — skip if uncertain)`;
        }
        if (pages.length === 0) {
          return `${renderedHeader}\nAvailable pages: (none found — skip if uncertain)`;
        }
        return `${renderedHeader}
Available pages (format: "<pageId>: <title>"):
${pages.map((page) => `  - ${page}`).join("\n")}`;
      }
      const compositePath = resolveGitHubPath(source.repo, source.path);
      const header = [
        `## Source ${sourceNumber}`,
        `Platform: ${source.platform}`,
        `Path: ${compositePath}`,
        `Branch: ${source.branch}`,
        `Audience: ${source.audience}`,
        `Purpose: ${source.purpose ?? "(not specified)"}`,
      ].join("\n");
      const listing = directoryListings.get(compositePath);
      // File source.
      if (listing === undefined) {
        return header;
      }
      if (!listing || listing.length === 0) {
        return `${header}\nAvailable files: (could not be retrieved — skip if uncertain)`;
      }

      return `${header}
Available files:
${listing.map((file) => `  - ${file}`).join("\n")}`;
    })
    .join("\n\n");

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
${renderedSources}
`.trim();

  const [error, result] = await expectError(
    callWithRetry(
      SYSTEM_PROMPT,
      userMessage,
      RoutedDocumentsResponseSchema,
      "routedDocuments"
    )
  );
  if (error || !result?.routedDocuments) {
    throw new Error("Failed to route documentation sources.", {
      cause: error,
    });
  }

  const pathToBranch = new Map(
    enabledSources
      .filter((source) => source.platform !== "confluence")
      .map((source) => [
        resolveGitHubPath(source.repo, source.path),
        source.branch,
      ])
  );

  return result.routedDocuments.map((document) => ({
    ...document,
    branch: pathToBranch.get(document.path) ?? "",
  }));
}
