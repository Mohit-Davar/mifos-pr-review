/**
 * Represents the result of the validation process for generated document edits.
 */
export interface ValidationResult {
  /** Whether the generated edits are valid and safe to apply. */
  isValid: boolean;
  /** An optional reason explaining why validation failed. */
  reason?: string;
  /** The final, updated content of the document if validation was successful. */
  updatedContent?: string;
}
