import { getOctokit } from "@actions/github";

/**
 * Parses an absolute GitHub path in the format `/owner/repository/path/to/resource`
 * into its repository and relative path components.
 *
 * @param path - Absolute-style GitHub path.
 * @param minSegments - Minimum number of required path segments.
 * @returns The repository owner, repository name and relative file path.
 * @throws If the path does not contain the required number of segments.
 */
function parseGitHubPath(
  path: string,
  minSegments = 2
): {
  filePath: string;
  owner: string;
  repo: string;
} {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < minSegments) {
    throw new Error(
      `Invalid GitHub path "${path}". Expected format: /owner/repository/<path>.`
    );
  }
  return {
    filePath: parts.slice(2).join("/"),
    owner: parts[0]!,
    repo: parts[1]!,
  };
}

/**
 * Lists all files within a GitHub directory using the Git Trees API.
 *
 * Unlike the Contents API, which requires one request per directory, the Git
 * Trees API retrieves the entire repository tree in a single request. The
 * returned tree is then filtered to include only files beneath the requested
 * directory.
 *
 * If the supplied path resolves to a single file instead of a directory, that
 * file is returned as the only entry.
 *
 * @param path - GitHub path to a directory or file.
 * @param token - GitHub personal access token.
 * @param branch - Branch to list files from.
 * @param maxFiles - Maximum number of files to return. Defaults to `500`.
 * @returns Absolute-style GitHub file paths.
 */
export async function listGitHubDirectory(
  path: string,
  token: string,
  branch: string,
  maxFiles = 500
): Promise<string[]> {
  const { filePath, owner, repo } = parseGitHubPath(path);
  const octokit = getOctokit(token);

  // Resolve the branch to its commit SHA.
  const {
    data: {
      commit: { sha: commitSha },
    },
  } = await octokit.rest.repos.getBranch({
    branch,
    owner,
    repo,
  });

  // Retrieve the complete repository tree.
  const { data: tree } = await octokit.rest.git.getTree({
    owner,
    recursive: "true",
    repo,
    tree_sha: commitSha,
  });

  const prefix = filePath ? `${filePath}/` : "";

  // If the requested path is itself a file, return it.
  const exactFile = tree.tree.find(
    (entry) => entry.type === "blob" && entry.path === filePath
  );
  if (exactFile) {
    return [`/${owner}/${repo}/${filePath}`];
  }
  return tree.tree
    .filter(
      (entry): entry is typeof entry & { path: string } =>
        entry.type === "blob" && !!entry.path && entry.path.startsWith(prefix)
    )
    .slice(0, maxFiles)
    .map((entry) => `/${owner}/${repo}/${entry.path}`);
}

/**
 * Retrieves the decoded UTF-8 content of a GitHub file.
 *
 * The path must be in the format:
 * `/owner/repository/path/to/file`
 *
 * @param path - GitHub path to a file.
 * @param token - GitHub personal access token.
 * @param branch - Branch to retrieve the file from.
 * @returns The decoded UTF-8 file contents.
 * @throws If the supplied path resolves to a directory or a non-file resource.
 */
export async function retrieveGitHubContent(
  path: string,
  token: string,
  branch: string
): Promise<string> {
  const { filePath, owner, repo } = parseGitHubPath(path, 3);
  const octokit = getOctokit(token);
  const response = await octokit.rest.repos.getContent({
    owner,
    path: filePath,
    ref: branch,
    repo,
  });
  if (
    Array.isArray(response.data) ||
    response.data.type !== "file" ||
    !response.data.content
  ) {
    throw new Error(`"${path}" does not resolve to a GitHub file.`);
  }
  return Buffer.from(response.data.content, "base64").toString("utf8");
}
