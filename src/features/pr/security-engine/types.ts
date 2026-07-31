import type { SeveritySchema } from "@src/features/pr/llm-call";
import { z } from "zod/v4";

export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Defines the structure for a security rule used by the engine.
 */
export interface SecurityRule {
  /**
   * A human-readable description of the security issue this rule detects.
   */
  description: string;
  /**
   * An optional array of file extensions (e.g., `.js`, `.py`) that this rule applies to.
   * If omitted, the rule applies to all files.
   */
  fileExtensions?: string[];
  /**
   * A unique identifier for the rule.
   */
  id: string;
  /**
   * The regular expression used to detect the security issue.
   */
  pattern: RegExp;
  /**
   * The severity of the finding (e.g., "high", "medium", "low").
   */
  severity: Severity;
}

/**
 * Represents a security finding identified by the engine.
 */
export interface Findings {
  /**
   * A description of the finding.
   */
  description: string;
  /**
   * The path to the file where the finding was detected.
   */
  file: string;
  /**
   * The line number in the file where the finding occurred.
   */
  line: number;
  /**
   * The severity of the finding.
   */
  severity: Severity;
}
