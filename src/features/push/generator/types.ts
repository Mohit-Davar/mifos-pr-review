import z from "zod/v4";

/**
 * A search-and-replace edit that modifies existing content in the document.
 * The `search` string must exist verbatim in the document exactly once.
 */
export interface DocumentEdit {
  /** The new content to append at the end of the document. */
  content?: string;
  operation: "replace" | "append";
  /** The new string to replace the `search` block with. */
  replace?: string;
  /** The exact block of text to find in the document. */
  search?: string;
}

// Defines the schema for the expected LLM response, containing a list of edits.
export const DocumentEditsSchema = z.object({
  edits: z.array(
    z.object({
      content: z.string().optional(),
      operation: z.enum(["replace", "append"]),
      replace: z.string().optional(),
      search: z.string().optional(),
    })
  ),
});
