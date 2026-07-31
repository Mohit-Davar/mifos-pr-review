import type { Review } from "@src/features/pr/llm-call";
import type { Findings, Severity } from "@src/features/pr/security-engine";

/**
 * Represents a single security finding as it is stored in the persistent state
 * within the PR summary comment.
 */
export interface StoredFinding {
  /** The ID of the PR comment associated with this finding, or null if not commented. */
  commentId: number | null;
  /** The file path where the finding is located. */
  file: string;
  /** A stable, unique identifier for the finding, used to track it across runs. */
  fingerprint: string;
  /** The line number of the finding. */
  line: number;
  /** The severity of the finding. */
  severity: Severity;
  /** The source of the finding (e.g., static analysis, dependency scan, or LLM). */
  source: "static" | "osv" | "llm";
}

/**
 * The complete state object that is serialized and embedded in the PR summary comment.
 */
export interface StoredReviewState {
  /** A list of all findings from the previous run. */
  findings: StoredFinding[];
  /** The version of the state schema, for handling future migrations. */
  version: 1;
}

/**
 * The status of a finding in the current run relative to the previous run.
 * - `new`: The finding was detected for the first time in this run.
 * - `active`: The finding was also present in the previous run.
 */
export type FindingStatus = "new" | "active";

/**
 * A union type representing a finding from the current run, linked to its
 * corresponding finding from the previous run (if one exists).
 */
export type CurrentFinding =
  | {
      /** The raw finding from the static or OSV scanner. */
      finding: Findings;
      fingerprint: string;
      /** The corresponding finding from the previous run, or null if this is a new finding. */
      previous: StoredFinding | null;
      source: "static" | "osv";
      status: FindingStatus;
    }
  | {
      fingerprint: string;
      previous: StoredFinding | null;
      /** The raw review object from the LLM. */
      review: Review;
      source: "llm";
      status: FindingStatus;
    };

/**
 * Represents a finding that was present in the previous run but is no longer
 * detected in the current run, i.e., it has been fixed.
 */
export interface ResolvedFinding {
  /** The original stored finding that is now considered fixed. */
  previous: StoredFinding;
}

/**
 * The result of the finding matching process, containing lists of
 * currently matched findings and newly fixed findings.
 */
export interface FindingMatchResult {
  /** A list of findings that are now fixed. */
  fixed: ResolvedFinding[];
  /** A list of findings that are new or active in the current run. */
  matched: CurrentFinding[];
}
