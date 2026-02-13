import type { Severity } from "@src/features/pr/llm-call";

export interface SecurityRule {
  id: string;
  description: string;
  pattern: RegExp;
  severity: Severity;
  fileExtensions?: string[];
}
