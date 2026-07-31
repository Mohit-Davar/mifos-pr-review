import {
  type Findings,
  rules as defaultRules,
  type SecurityRule,
} from "@src/features/pr/security-engine";
import { getConfig, type ParsedFileDiff } from "@src/shared";

/**
 * Runs a set of security rules against the added lines in a collection of file diffs.
 *
 * @param diffs - An array of parsed file diffs representing the changes in a pull request.
 * @returns An array of `Findings` for any security issues detected.
 *
 * @remarks
 * The engine uses a default set of security rules and can be extended with custom rules
 * defined in the configuration file (`.github/review.yml`). It iterates through each
 * added line in the diffs and tests it against applicable rules based on file extension
 * and regex patterns.
 */
export function runSecurityEngine(diffs: ParsedFileDiff[]): Findings[] {
  const findings: Findings[] = [];
  const config = getConfig();
  const rules: SecurityRule[] = [...defaultRules];

  // Load custom rules from the configuration file.
  if (config.review?.security?.rules) {
    for (const rule of config.review.security.rules) {
      rules.push({
        description: rule.description,
        fileExtensions: rule.fileExtensions,
        id: rule.id,
        pattern: new RegExp(rule.pattern),
        severity: rule.severity,
      });
    }
  }

  for (const fileDiff of diffs) {
    const fileExtension = fileDiff.file.substring(
      fileDiff.file.lastIndexOf(".")
    );
    // Filter rules to only those applicable to the current file's extension.
    const applicableRules = rules.filter((rule) => {
      if (!rule.fileExtensions) {
        return true; // Rule applies to all files if no extensions are specified.
      }
      return rule.fileExtensions.includes(fileExtension);
    });

    for (const addedLine of fileDiff.added) {
      for (const rule of applicableRules) {
        if (!rule.pattern.test(addedLine.content)) {
          continue;
        }
        // If a rule's pattern matches, create a finding.
        findings.push({
          description: rule.description,
          file: fileDiff.file,
          line: addedLine.lineNumber,
          severity: rule.severity,
        });
      }
    }
  }

  return findings;
}
