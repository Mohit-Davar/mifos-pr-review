import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import type { Review, Reviews } from "@src/features/pr/llm-call/types";
import { rules } from "@src/features/pr/security-engine/rules";

export function runSecurityEngine(diffs: ParsedFileDiff[]): Reviews {
  const reviews: Review[] = [];

  for (const fileDiff of diffs) {
    const fileExtension = fileDiff.file.substring(
      fileDiff.file.lastIndexOf(".")
    );

    // Filter rules by file extension
    const applicableRules = rules.filter(
      (rule) =>
        !rule.fileExtensions || rule.fileExtensions.includes(fileExtension)
    );

    for (const addedLine of fileDiff.added) {
      const lineContent = addedLine.content;

      for (const rule of applicableRules) {
        if (rule.pattern.test(lineContent)) {
          reviews.push({
            file: fileDiff.file,
            line: addedLine.lineNumber,
            severity: rule.severity,
            comment: rule.description,
          });
        }
      }
    }
  }

  return { reviews };
}
