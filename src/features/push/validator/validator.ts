import type { DocumentEdit } from "@src/features/push/generator";
import type { ValidationResult } from "@src/features/push/validator";

/**
 * Applies and validates a series of document edits.
 * Supports two operation types:
 * - `replace`: Finds an exact string in the document and replaces it. The search
 *   string must exist verbatim exactly once.
 * - `append`: Appends new content to the end of the document. Used for new sections
 *   or concepts introduced by the PR that have no existing anchor text.
 *
 * @param currentContent - The original content of the document.
 * @param edits - An array of edits to apply (replace or append operations).
 * @param codeDiff - The raw diff string of the code changes, used for reasonableness checks.
 * @returns A `ValidationResult` object indicating whether the edits are valid and, if so, the `updatedContent`.
 */
export function applyAndValidateEdits(
  currentContent: string,
  edits: DocumentEdit[],
  codeDiff: string
): ValidationResult {
  let content = currentContent;

  for (const edit of edits) {
    if (edit.operation === "append") {
      // Append new content at the end of the document.
      // Ensure there is exactly one blank line separating the existing content from the appended block, regardless of trailing whitespace.
      content = content.trimEnd() + "\n\n" + edit.content;
      continue;
    }

    // replace operation
    if (!edit.search) {
      return {
        isValid: false,
        reason: "Edit contains an empty search pattern.",
      };
    }

    // Ensure each `search` pattern appears exactly once.
    const firstIndex = content.indexOf(edit.search);
    if (firstIndex === -1) {
      return {
        isValid: false,
        reason: `Search pattern not found in document: "${edit.search.substring(
          0,
          50
        )}..."`,
      };
    }
    const lastIndex = content.lastIndexOf(edit.search);
    if (firstIndex !== lastIndex) {
      return {
        isValid: false,
        reason: `Search pattern is not unique: "${edit.search.substring(
          0,
          50
        )}..."`,
      };
    }
    // Apply the replacement.
    content =
      content.substring(0, firstIndex) +
      edit.replace +
      content.substring(firstIndex + edit.search.length);
  }

  // Ensure markdown code blocks are not left unclosed.
  const originalCodeBlocks = (currentContent.match(/```/g) || []).length;
  const newCodeBlocks = (content.match(/```/g) || []).length;
  if (newCodeBlocks % 2 !== 0 && originalCodeBlocks % 2 === 0) {
    return {
      isValid: false,
      reason:
        "Validation failed: an odd number of markdown code blocks (```) were detected, which may indicate broken formatting.",
    };
  }

  // Prevent excessively large changes relative to the code diff.
  const diffSize = codeDiff.length;
  const changeSize = Math.abs(content.length - currentContent.length);
  const maxReasonableChange = Math.max(4000, diffSize * 3);
  if (changeSize > maxReasonableChange) {
    return {
      isValid: false,
      reason: `Generated change size (${changeSize} chars) is unreasonably large compared to code diff size (${diffSize} chars).`,
    };
  }

  // For multi-file documents, ensure file headers are not altered.
  const headerRegex = /^--- File: (.*?) ---$/gm;
  const originalHeaders = Array.from(
    currentContent.matchAll(headerRegex),
    (m) => m[0]
  );
  if (originalHeaders.length > 0) {
    const updatedHeaders = Array.from(
      content.matchAll(headerRegex),
      (m) => m[0]
    );
    if (
      originalHeaders.length !== updatedHeaders.length ||
      !originalHeaders.every((val, index) => val === updatedHeaders[index])
    ) {
      return {
        isValid: false,
        reason:
          "Validation failed: File header markers (e.g., '--- File: <path> ---') were modified or deleted.",
      };
    }
  }

  return {
    isValid: true,
    updatedContent: content,
  };
}
