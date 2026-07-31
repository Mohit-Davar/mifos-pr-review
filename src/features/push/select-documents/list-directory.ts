import * as core from "@actions/core";
import { listGitHubDirectory } from "@src/features/push/retriever";
import { expectError } from "@src/shared";

/**
 * Pre-fetches the file listing for a GitHub directory source so the LLM can
 * select specific files rather than routing to a folder path.
 *
 * Returns `null` if the listing fails (non-fatal — the source is still included
 * in the prompt without a file list, and the LLM will skip it or route conservatively).
 *
 * @param path - The GitHub path to the directory (e.g. `/owner/repo/docs`).
 * @param token - GitHub personal access token for the docs repository.
 * @returns A list of specific file paths, or `null` if the listing failed.
 */
export async function fetchDirectoryListing(
  path: string,
  token: string
): Promise<string[] | null> {
  const [err, files] = await expectError(listGitHubDirectory(path, token));
  if (err) {
    core.warning(
      `Could not list GitHub directory "${path}": ${err.message}. The LLM will not see its file listing.`
    );
    return null;
  }
  return files;
}

/**
 * Determines whether a GitHub source path points to a directory (no file extension)
 * vs. a specific file.
 */
export function isDirectoryPath(path: string): boolean {
  const lastSegment = path.split("/").filter(Boolean).at(-1) ?? "";
  return !lastSegment.includes(".");
}
