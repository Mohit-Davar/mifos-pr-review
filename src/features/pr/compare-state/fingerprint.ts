/**
 * Normalises a code snippet for use in a fingerprint.
 * This involves trimming, collapsing whitespace, converting to lowercase, and truncating.
 * @param snippet - The raw code snippet.
 * @param maxLength - The maximum length of the normalised snippet.
 * @returns The normalised snippet.
 */
export function normaliseSnippet(snippet: string, maxLength = 120): string {
  return snippet.trim().replace(/\s+/g, " ").toLowerCase().slice(0, maxLength);
}

/**
 * Creates a fingerprint for a finding from the static security engine.
 * @param ruleId - The ID of the rule that was triggered.
 * @param file - The file where the finding occurred.
 * @param lineContent - The content of the line with the finding.
 * @returns A stable fingerprint string.
 * @example `static:hardcoded-secret:src/auth.ts:const api_key = "..."`
 */
export function fingerprintStatic(
  ruleId: string,
  file: string,
  lineContent: string
): string {
  return `static:${ruleId}:${file}:${normaliseSnippet(lineContent)}`;
}

/**
 * Creates a fingerprint for a dependency vulnerability (OSV) finding.
 * @param pkgName - The name of the vulnerable package.
 * @param pkgVersion - The version of the vulnerable package.
 * @param osvIds - An array of OSV vulnerability IDs (e.g., CVEs, GHSAs).
 * @returns A stable fingerprint string.
 * @example `osv:lodash@4.17.20:CVE-2021-23337,GHSA-35jh-r3h4-6jhm`
 */
export function fingerprintOSV(
  pkgName: string,
  pkgVersion: string,
  osvIds: string[]
): string {
  const ids = [...osvIds].sort().join(",");
  return `osv:${pkgName}@${pkgVersion}:${ids}`;
}

/**
 * Creates a fingerprint for an LLM-generated finding.
 * @param file - The file where the finding occurred.
 * @param lineContent - The content of the line with the finding.
 * @returns A stable fingerprint string.
 * @example `llm:src/auth.ts:db.query(\`select * from users\`)`
 */
export function fingerprintLLM(file: string, lineContent: string): string {
  return `llm:${file}:${normaliseSnippet(lineContent)}`;
}
