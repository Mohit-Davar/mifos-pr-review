import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import { encoding_for_model } from "tiktoken";

// Estimates the token cost of a single file diff.
export function countFileTokens(file: ParsedFileDiff): number {
  // Build the same formatted text we'll eventually send to the LLM
  const lines = [
    `### ${file.file}`,
    ...file.context.map((line) => ` ${line.lineNumber}: ${line.content}`),
    ...file.added.map((line) => `+${line.lineNumber}: ${line.content}`),
    ...file.removed.map((line) => `-${line.lineNumber}: ${line.content}`),
  ];

  const encoder = encoding_for_model("gpt-5-mini");
  try {
    return encoder.encode(lines.join("\n")).length;
  } finally {
    encoder.free();
  }
}
