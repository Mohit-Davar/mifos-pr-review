import { getOctokit } from "@actions/github";

/**
 * Parses a GitHub path string in the format `/owner/repo/path/to/...` into its components.
 */
function parseGitHubPath(
  path: string,
  minSegments = 2
): { filePath: string; owner: string; repo: string } {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < minSegments) {
    throw new Error(
      `Invalid GitHub path "${path}". Expected format: /owner/repository/path`
    );
  }
  return {
    filePath: parts.slice(2).join("/"),
    owner: parts[0]!,
    repo: parts[1]!,
  };
}

/**
 * Lists all file paths directly inside a GitHub directory (shallow, non-recursive).
 * Returns only file entries — not sub-directories. Use this to pre-fetch a directory's
 * structure before passing it to an LLM for precise file selection.
 *
 * If the path resolves to a single file rather than a directory, that file's path is
 * returned as the only element.
 *
 * The path must be in the format:
 * `/owner/repository/path/to/directory`
 *
 * @param path - GitHub path to a directory (or file).
 * @param token - GitHub personal access token.
 * @returns A flat list of absolute-style GitHub file paths found directly in the directory.
 */
export async function listGitHubDirectory(
  path: string,
  token: string
): Promise<string[]> {
  const { filePath, owner, repo } = parseGitHubPath(path);
  const octokit = getOctokit(token);

  const response = await octokit.rest.repos.getContent({
    owner,
    path: filePath,
    repo,
  });

  if (!Array.isArray(response.data)) {
    // Path resolves to a single file — return it as-is.
    return [path];
  }

  return response.data
    .filter((item) => item.type === "file")
    .map((item) => `/${owner}/${repo}/${item.path}`);
}

/**
 * Retrieves the decoded text content of a single file from a GitHub repository.
 *
 * The path must be in the format:
 * `/owner/repository/path/to/file.md`
 *
 * @param path - GitHub path to a file.
 * @param token - GitHub personal access token.
 * @returns The decoded UTF-8 content of the file.
 * @throws If the path points to a directory rather than a file.
 */
export async function retrieveGitHubContent(
  path: string,
  token: string
): Promise<string> {
  const { filePath, owner, repo } = parseGitHubPath(path, 3);
  const octokit = getOctokit(token);

  const response = await octokit.rest.repos.getContent({
    owner,
    path: filePath,
    repo,
  });

  if (
    Array.isArray(response.data) ||
    response.data.type !== "file" ||
    !("content" in response.data)
  ) {
    throw new Error(
      `"${path}" is not a valid GitHub file. If this is a directory, ensure the LLM routes to specific files within it.`
    );
  }

  return Buffer.from(response.data.content, "base64").toString("utf8");
}
