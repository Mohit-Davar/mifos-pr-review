import type { ParsedFileDiff } from "@src/shared";

/**
 * Retrieves the raw text content of a specifically added line from the parsed diff collection.
 * @param file - The target filename containing the line modification.
 * @param line - The specific target line number to retrieve.
 * @param diffs - The full array of parsed file difference objects collected from the PR.
 * @returns The string contents of the added line, or an empty string if not found.
 * @remarks
 * This functions queries against the nested file structural mapping. It specifically checks
 * the `added` collection since vulnerabilities and security flags are indexed by insertion targets.
 */
export function getLineContent(
  file: string,
  line: number,
  diffs: ParsedFileDiff[]
): string {
  return (
    diffs.find((d) => d.file === file)?.added.find((a) => a.lineNumber === line)
      ?.content ?? ""
  );
}

/**
 * Extracts the structured package coordinates and vulnerability identities from an OSV description string.
 * @param description - The formatted textual finding description containing package details and vulnerability list.
 * @returns A structured object mapping the parsed `pkgName`, `pkgVersion`, and extracted `osvIds`.
 * @remarks
 * This function utilizes explicit regular expression pairings to scan out text matches. It handles both
 * standard CVE boundaries (`CVE-YYYY-NNNNN`) and GitHub Security Advisory references (`GHSA-xxxx-xxxx-xxxx`)
 * interchangeably while normalizing output identifiers to uppercase.
 */
export function parseOSVDescription(description: string): {
  osvIds: string[];
  pkgName: string;
  pkgVersion: string;
} {
  // Extract package name, version, and vulnerability IDs from an OSV finding description.
  // Example: "Added dependency `lodash@4.17.20` has known vulnerabilities: CVE-2021-23337, GHSA-35jh-r3h4-6jhm."
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

/**
 * Generates a normalized rule fingerprint ID from an arbitrary security engine finding description text block.
 * @param description - The engine diagnostic narrative string explaining the flagged violation.
 * @returns A slugified string used as a distinct identity signature for tracking state.
 * @remarks
 * Security-engine descriptions are deterministic, so a normalised prefix of the description can be used as fingerprint input.
 * The token generation cuts off strings past 40 index allocations and replaces inner whitespace groups with hyphens.
 */
export function inferRuleId(description: string): string {
  return description.trim().slice(0, 40).toLowerCase().replace(/\s+/g, "-");
}
