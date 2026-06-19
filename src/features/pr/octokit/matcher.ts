import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import type { Review } from "@src/features/pr/llm-call";
import type {
  FixedFinding,
  MatchedFinding,
  MatchResult,
  PersistedFinding,
  PersistedState,
} from "@src/features/pr/octokit";
import {
  fingerprintLLM,
  fingerprintOSV,
  fingerprintStatic,
  normaliseSnippet,
} from "@src/features/pr/octokit";
import type { Findings } from "@src/features/pr/security-engine";
import stringSimilarity from "string-similarity";

const FUZZY_THRESHOLD = 0.7;

function getLineContent(
  file: string,
  line: number,
  diffs: ParsedFileDiff[]
): string {
  return (
    diffs.find((d) => d.file === file)?.added.find((a) => a.lineNumber === line)
      ?.content ?? ""
  );
}

// Extract package name, version, and vulnerability IDs from an
// OSV finding description.
//
// Example:
// "Added dependency `lodash@4.17.20` has known vulnerabilities:
// CVE-2021-23337, GHSA-35jh-r3h4-6jhm."
function parseOSVDescription(description: string): {
  osvIds: string[];
  pkgName: string;
  pkgVersion: string;
} {
  const pkg = description.match(/`([^@`]+)@([^`]+)`/);
  const pkgName = pkg?.[1] ?? "unknown";
  const pkgVersion = pkg?.[2] ?? "unknown";

  const idMatches = [
    ...description.matchAll(/\b(CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)\b/gi),
  ];
  const osvIds = idMatches.map((match) => match[0].toUpperCase());

  return {
    osvIds,
    pkgName,
    pkgVersion,
  };
}

// Generate a stable identifier for a security-engine rule.
// Security-engine descriptions are deterministic, so a normalised
// prefix of the description can be used as fingerprint input.
function inferRuleId(description: string): string {
  return description.trim().slice(0, 40).toLowerCase().replace(/\s+/g, "-");
}

// Match current findings with findings from the previous run.
// - active: finding already exists
// - new: finding was not seen before
// - fixed: finding existed previously but is no longer present
export function matchFindings(
  staticFindings: Findings[],
  osvFindings: Findings[],
  llmReviews: Review[],
  diffs: ParsedFileDiff[],
  previous: PersistedState
): MatchResult {
  // Track previous findings by fingerprint for quick lookups.
  const previousFindings = new Map<string, PersistedFinding>(
    previous.findings.map((finding) => [finding.fingerprint, finding])
  );

  // Previous findings that have already been matched in this run.
  const matchedPrevious = new Set<string>();
  const matched: MatchedFinding[] = [];

  // Find a matching finding from the previous run.
  function findPrevious(fingerprint: string): PersistedFinding | undefined {
    const finding = previousFindings.get(fingerprint);
    if (finding) {
      matchedPrevious.add(fingerprint);
    }
    return finding;
  }

  // Match static-analysis findings using exact fingerprints.
  for (const finding of staticFindings) {
    const lineContent = getLineContent(finding.file, finding.line, diffs);
    const ruleId = inferRuleId(finding.description);
    const fingerprint = fingerprintStatic(ruleId, finding.file, lineContent);
    const previousFinding = findPrevious(fingerprint);
    matched.push({
      finding,
      fingerprint,
      previous: previousFinding ?? null,
      source: "static",
      status: previousFinding ? "active" : "new",
    });
  }

  // Match dependency vulnerabilities using package and
  // vulnerability identifiers.
  for (const finding of osvFindings) {
    const { osvIds, pkgName, pkgVersion } = parseOSVDescription(
      finding.description
    );
    const fingerprint = fingerprintOSV(pkgName, pkgVersion, osvIds);
    const previousFinding = findPrevious(fingerprint);
    matched.push({
      finding,
      fingerprint,
      previous: previousFinding ?? null,
      source: "osv",
      status: previousFinding ? "active" : "new",
    });
  }

  // Match LLM findings.
  // First try an exact fingerprint match.
  // If that fails, use fuzzy matching to handle line shifts
  // and small code changes that still represent the same issue.
  for (const review of llmReviews) {
    const lineContent = getLineContent(review.file, review.line, diffs);
    const fingerprint = fingerprintLLM(review.file, lineContent);
    const exactMatch = findPrevious(fingerprint);
    if (exactMatch) {
      matched.push({
        fingerprint,
        previous: exactMatch,
        review,
        source: "llm",
        status: "active",
      });
      continue;
    }

    const normalisedCurrentSnippet = normaliseSnippet(lineContent);

    let bestScore = 0;
    let bestMatch: PersistedFinding | null = null;
    // Compare the current snippet against unmatched LLM
    // findings from the previous run and keep the closest match.
    for (const [previousFingerprint, previousFinding] of previousFindings) {
      if (
        matchedPrevious.has(previousFingerprint) ||
        previousFinding.source !== "llm"
      ) {
        continue;
      }

      const prefix = `llm:${previousFinding.file}:`;
      const previousSnippet = previousFingerprint.startsWith(prefix)
        ? previousFingerprint.slice(prefix.length)
        : "";

      const score = stringSimilarity.compareTwoStrings(
        normalisedCurrentSnippet,
        previousSnippet
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = previousFinding;
      }
    }

    // Treat highly similar snippets as the same finding.
    if (bestScore >= FUZZY_THRESHOLD && bestMatch) {
      matchedPrevious.add(bestMatch.fingerprint);
      matched.push({
        fingerprint,
        previous: bestMatch,
        review,
        source: "llm",
        status: "active",
      });
      continue;
    }
    matched.push({
      fingerprint,
      previous: null,
      review,
      source: "llm",
      status: "new",
    });
  }

  // Any previous finding that wasn't matched in this run
  // is considered fixed.
  const fixed: FixedFinding[] = [];

  for (const [fingerprint, previousFinding] of previousFindings) {
    if (!matchedPrevious.has(fingerprint)) {
      fixed.push({
        previous: previousFinding,
      });
    }
  }

  return {
    fixed,
    matched,
  };
}
