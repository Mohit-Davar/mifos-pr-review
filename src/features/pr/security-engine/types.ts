export type Severity = "high" | "medium" | "low";

export interface SecurityRule {
  description: string;
  fileExtensions?: string[];
  id: string;
  pattern: RegExp;
  severity: Severity;
}
