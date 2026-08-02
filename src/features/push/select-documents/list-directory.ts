import * as core from "@actions/core";
import {
  listConfluenceSpacePages,
  listGitHubDirectory,
} from "@src/features/push/retriever";
import {
  getCachedDirectoryListing,
  setCachedDirectoryListing,
} from "@src/features/push/select-documents/cache";
import { expectError, type PlatformCredentials } from "@src/shared";

/**
 * Pre-fetches the file listing for a GitHub directory source so the LLM can
 * select specific files rather than routing to a folder path.
 *
 * Results are persisted in `.mifoshawk/directory-cache.json` in the workspace
 * so they can survive across action runs when restored via `actions/cache`.
 * Cached entries expire after one hour.
 *
 * Returns `null` if the listing cannot be retrieved. This is non-fatal: the
 * source is still included in the prompt without a file list, allowing the LLM
 * to skip it or route conservatively.
 *
 * @param path - GitHub directory path in the format `/owner/repo/path`.
 * @param token - GitHub access token for the documentation repository.
 * @param branch - Branch to list the directory from.
 * @returns List of file paths, or `null` if the listing failed.
 */
export async function fetchDirectoryListing(
  path: string,
  token: string,
  branch: string
): Promise<string[] | null> {
  const [, owner, repo] = path.split("/");
  const repoSlug = `${owner}/${repo}`;
  // Check cache first.
  const cached = getCachedDirectoryListing(repoSlug, branch, path);
  if (cached !== null) {
    core.debug(
      `Using cached directory listing for "${path}" (branch: ${branch})`
    );
    return cached;
  }
  // Cache miss. Fetch the latest directory listing from GitHub.
  const [error, files] = await expectError(
    listGitHubDirectory(path, token, branch)
  );
  if (error || !files) {
    const reason = error?.message ?? "unknown error";
    core.warning(
      `Could not list GitHub directory "${path}": ${reason}. Skipping file list.`
    );
    return null;
  }
  setCachedDirectoryListing(repoSlug, branch, path, files);
  return files;
}

/**
 * Determines whether a GitHub source path refers to a directory rather than
 * a specific file.
 *
 * Assumes directory names do not contain file extensions.
 */
export function isDirectoryPath(path: string): boolean {
  const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
  return !lastSegment.includes(".");
}

/**
 * Pre-fetches the page listing for a Confluence space so the LLM can
 * select specific page IDs instead of routing to the entire space.
 *
 * Results are cached to avoid repeated API calls. Failures are non-fatal:
 * the source is still included in the prompt without page information.
 *
 * @param spaceKey - Confluence space key (for example, `"DOCS"`).
 * @param credentials - Confluence API credentials.
 * @returns List of `"<pageId>: <title>"` entries, or `null` if the listing failed.
 */
export async function fetchSpaceListing(
  spaceKey: string,
  credentials: NonNullable<PlatformCredentials["confluence"]>
): Promise<string[] | null> {
  const cacheNamespace = "confluence";
  const cacheKey = `confluence:${spaceKey}`;
  // Check cache first.
  const cached = getCachedDirectoryListing(cacheKey, cacheNamespace, cacheKey);
  if (cached !== null) {
    core.debug(`Using cached space listing for Confluence space "${spaceKey}"`);
    return cached;
  }
  // Cache miss. Fetch the latest page listing from Confluence.
  const [error, pages] = await expectError(
    listConfluenceSpacePages(
      spaceKey,
      credentials.baseUrl,
      credentials.username,
      credentials.apiToken
    )
  );
  if (error || !pages) {
    const reason = error?.message ?? "unknown error";
    core.warning(
      `Could not list Confluence space "${spaceKey}": ${reason}. Skipping page list.`
    );
    return null;
  }
  const entries = pages.map((page) => `${page.id}: ${page.title}`);
  setCachedDirectoryListing(cacheKey, cacheNamespace, cacheKey, entries);
  return entries;
}
