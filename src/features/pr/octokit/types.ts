import type { StoredReviewState } from "@src/features/pr/compare-state";
import type { Severity } from "@src/features/pr/security-engine";
import type { LinkedIssue } from "@src/shared/github";

/**
 * Represents the state loaded from a PR, including the parsed state object
 * and the ID of the summary comment it was loaded from.
 */
export interface LoadedReviewState {
  /** The parsed state from the previous run. */
  state: StoredReviewState;
  /** The ID of the summary comment. */
  summaryCommentId: number | null;
}

/**
 * A normalized representation of a finding for display in the summary table.
 */
export interface SummaryRow {
  file: string;
  line: number;
  problem: string;
  severity: Severity;
  status: "new" | "active";
}

/**
 * Aggregated metadata structure containing git and issue tracker information for a target Pull Request.
 */
export interface PRContext {
  /** An array of first-line subject text strings extracted from each commit in the Pull Request. */
  commitMessages: string[];
  /** The sanitized, markdown-stripped description body text of the Pull Request. */
  description: string;
  /** A deterministically ordered list of validated tracking issues referenced within the pull scope. */
  linkedIssues: LinkedIssue[];
  /** The top-level title string of the Pull Request. */
  title: string;
}
