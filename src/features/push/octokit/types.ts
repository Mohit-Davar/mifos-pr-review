/**
 * Represents a file that was changed in a pull request.
 */
export interface ChangedFile {
  /** The path of the file. */
  path: string;
  /** The status of the file change (e.g., "added", "modified", "removed", "renamed"). */
  status: string;
}

/**
 * Represents the comprehensive context of a pull request, used for documentation generation.
 */
export interface PRContext {
  /** A list of files changed in the pull request. */
  changedFiles: ChangedFile[];
  /** An array of commit messages from the pull request. */
  commits: string[];
  /** The body/description of the pull request. */
  description: string;
  /** The raw unified diff of the pull request. */
  diff: string;
  /** A list of labels applied to the pull request. */
  labels: string[];
  /** The title of the pull request. */
  title: string;
}
