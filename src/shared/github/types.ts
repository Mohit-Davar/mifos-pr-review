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
 * Represents an issue linked to the pull request.
 */
export interface LinkedIssue {
  /** The unique identifier or issue number on the tracker. */
  number: number;
  /** The summary title text retrieved from the issue definition. */
  title: string;
}

/**
 * Standardized representation of a Pull Request's complete context.
 */
export interface PRContext {
  /** A list of files changed in the Pull Request. */
  changedFiles: ChangedFile[];
  /** An array of first-line subject text strings extracted from each commit in the Pull Request. */
  commitMessages: string[];
  /** An array of the full commit messages from the Pull Request. */
  commits: string[];
  /** The raw body/description description text of the Pull Request. */
  description: string;
  /** The raw unified diff of the Pull Request. */
  diff: string;
  /** A list of labels applied to the Pull Request. */
  labels: string[];
  /** A deterministically ordered list of validated tracking issues referenced within the pull scope. */
  linkedIssues: LinkedIssue[];
  /** The sanitized, markdown-stripped description body text of the Pull Request. */
  strippedDescription: string;
  /** The top-level title string of the Pull Request. */
  title: string;
}
