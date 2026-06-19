import type { Review } from "@src/features/pr/llm-call";
import type { Findings, Severity } from "@src/features/pr/security-engine";

export interface PersistedFinding {
  commentId: number | null; // PR comment created for this finding, or null if no comment was posted.
  file: string;
  fingerprint: string; // Unique ID used to track the finding across runs.
  line: number;
  severity: Severity;
  source: "static" | "osv" | "llm"; // Detector that reported the finding.
}

export interface PersistedState {
  findings: PersistedFinding[]; // Previously saved findings.
  version: 1; // State format version.
}

export interface LoadedState {
  state: PersistedState; // Previously saved findings.
  summaryCommentId: number | null; // Summary comment ID, null on first run.
}

export type FindingStatus = "new" | "active" | "fixed";

/**
 * A finding from the current run, cross-referenced against previous state.
 * Discriminated by `source` so callers get proper narrowing.
 */
export type MatchedFinding =
  | {
      finding: Findings;
      fingerprint: string;
      previous: PersistedFinding | null;
      source: "static" | "osv";
      status: FindingStatus;
    }
  | {
      fingerprint: string;
      previous: PersistedFinding | null;
      review: Review;
      source: "llm";
      status: FindingStatus;
    };

/** A finding from a previous run that has no match in the current run. */
export interface FixedFinding {
  previous: PersistedFinding;
}

export interface MatchResult {
  fixed: FixedFinding[];
  matched: MatchedFinding[];
}
