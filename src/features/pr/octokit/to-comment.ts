import type { Review } from "@src/features/pr/llm-call/types";

export const toComment = (f: Review) => ({
  path: f.file,
  line: f.line,
  body: `**${f.severity.toUpperCase()}**: ${f.comment}`,
});
