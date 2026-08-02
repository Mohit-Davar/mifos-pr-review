import type { DocumentEdit } from "@src/features/push/generator";
import type { ValidationResult } from "@src/features/push/validator";

/**
 * Applies and validates LLM-generated document edits.
 *
 * Supported operations:
 * - `replace`: Replaces an existing unique string in the document.
 * - `append`: Appends new content to the end of the document.
 *
 * Validation ensures:
 * - Replace targets exist exactly once.
 * - Markdown code fences remain balanced.
 * - Multi-file document headers are preserved.
 *
 * @example
 * const currentContent = "Hello world";
 * const edits = [{ operation: "replace", search: "world", replace: "universe" }];
 * const result = validateEdits(currentContent, edits, "+ some diff");
 * result.isValid === true
 * result.updatedContent === "Hello universe"
 *
 * @param currentContent - Original document content.
 * @param edits - LLM-generated edit operations.
 * @param codeDiff - Raw git diff (used for lightweight sanity checks).
 * @returns Validation result containing either the updated document or the failure reason.
 */
export function validateEdits(
  currentContent: string,
  edits: DocumentEdit[],
  codeDiff: string
): ValidationResult {
  let updatedContent = currentContent;

  for (const edit of edits) {
    if (edit.operation === "append") {
      // Example: updatedContent = "Title", edit.content = "Subtitle"
      // Result: "Title\n\nSubtitle"
      const content = edit.content ?? "";
      updatedContent = updatedContent.trimEnd() + "\n\n" + content;
      continue;
    }

    // Example: edit = { operation: "replace", search: "", replace: "new data" }
    // This is rejected because we don't know what to replace.
    if (!edit.search) {
      return {
        isValid: false,
        reason: "Replace operation contains an empty search string.",
      };
    }

    const firstIndex = updatedContent.indexOf(edit.search);
    // Example: If updatedContent is "apple banana" and edit.search is "orange",
    // firstIndex is -1. We must reject since the target text is missing.
    if (firstIndex === -1) {
      return {
        isValid: false,
        reason: `Search pattern not found: "${edit.search.slice(0, 50)}..."`,
      };
    }

    // Example: If updatedContent is "apple apple" and edit.search is "apple",
    // firstIndex is 0 but lastIndexOf is 6. We reject it to prevent replacing the wrong occurrence.
    if (firstIndex !== updatedContent.lastIndexOf(edit.search)) {
      return {
        isValid: false,
        reason: `Search pattern is not unique: "${edit.search.slice(0, 50)}..."`,
      };
    }

    // Example: updatedContent = "abc", search = "b", replace = "X"
    // slice(0, 1) -> "a"
    // edit.replace -> "X"
    // slice(1 + 1) -> "c"
    // Result: "aXc"
    const replace = edit.replace ?? "";
    updatedContent =
      updatedContent.slice(0, firstIndex) +
      replace +
      updatedContent.slice(firstIndex + edit.search.length);
  }

  // Ensure markdown code fences remain balanced.
  // Example: If the original file had two ``` marks (one open, one close),
  // but the LLM outputted three ``` marks, it leaves a trailing unclosed block.
  const originalFenceCount = (currentContent.match(/```/g) ?? []).length;
  const updatedFenceCount = (updatedContent.match(/```/g) ?? []).length;
  if (originalFenceCount % 2 === 0 && updatedFenceCount % 2 !== 0) {
    return {
      isValid: false,
      reason: "Generated document contains an unclosed markdown code block.",
    };
  }

  // Preserve multi-file document headers.
  // Example: Validates that markers like "--- File: src/main.ts ---"
  // weren't accidentally deleted or modified by the LLM during generation.
  const headerPattern = /^--- File: .* ---$/gm;
  const originalHeaders = Array.from(
    currentContent.matchAll(headerPattern),
    (match) => match[0]
  );
  if (originalHeaders.length > 0) {
    const updatedHeaders = Array.from(
      updatedContent.matchAll(headerPattern),
      (match) => match[0]
    );
    // Example: Comparing ["--- File: index.ts ---"] against what the LLM produced.
    // They must match perfectly in length and string value.
    const headersMatch =
      originalHeaders.length === updatedHeaders.length &&
      originalHeaders.every(
        (header, index) => header === updatedHeaders[index]
      );
    if (!headersMatch) {
      return {
        isValid: false,
        reason: "Generated document modified multi-file header markers.",
      };
    }
  }
  // Example: If a 100-character document is edited, and the new version is 5,000 characters,
  // but the codeDiff was only 20 characters long, the LLM likely hallucinated massive text chunks.
  const changeSize = Math.abs(updatedContent.length - currentContent.length);
  if (
    currentContent.length > 0 &&
    changeSize > Math.max(currentContent.length * 5, codeDiff.length * 20)
  ) {
    return {
      isValid: false,
      reason:
        "Generated document change is unexpectedly large relative to the original document.",
    };
  }

  return {
    isValid: true,
    reason: "",
    updatedContent,
  };
}
