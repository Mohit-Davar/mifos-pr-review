import z from "zod/v4";

/**
 * A search-and-replace edit that modifies existing content in the document.
 * The `search` string must exist verbatim in the document exactly once.
 */
export interface ReplaceEdit {
  operation: "replace";
  /** The new string to replace the `search` block with. */
  replace: string;
  /** The exact block of text to find in the document (must be unique). */
  search: string;
}

/**
 * An append edit that adds entirely new content to the end of the document.
 * Use this when the PR introduces a new concept, section, or API that does not
 * correspond to any existing text in the document.
 */
export interface AppendEdit {
  /** The new content to append at the end of the document. */
  content: string;
  operation: "append";
}

/**
 * Represents a single edit operation to be performed on a document.
 * Either a targeted search/replace or an append of new content.
 */
export type DocumentEdit = ReplaceEdit | AppendEdit;

// Defines the schema for a search-and-replace edit.
const ReplaceEditSchema = z.object({
  operation: z.literal("replace"),
  replace: z.string(),
  search: z.string(),
});

// Defines the schema for an append edit.
const AppendEditSchema = z.object({
  content: z.string(),
  operation: z.literal("append"),
});

// Defines the schema for the expected LLM response, containing a list of edits.
export const DocumentEditsSchema = z.object({
  edits: z.array(
    z.discriminatedUnion("operation", [ReplaceEditSchema, AppendEditSchema])
  ),
});
