import type { Review } from "@src/features/pr/llm-call/types";

export const toComment = (f: Review) => ({
  body: `**${f.severity.toUpperCase()}**: ${f.comment}`,
  line: f.line,
  path: f.file,
});
