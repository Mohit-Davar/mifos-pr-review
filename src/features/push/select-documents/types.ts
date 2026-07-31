import { z } from "zod";

/**
 * Defines the schema for a document that has been selected by the LLM for an update.
 */
export const RoutedDocumentSchema = z.object({
  /** The path to the document (e.g., `/owner/repo/file.md` or a Confluence page ID). */
  path: z.string(),
  /** The platform where the document is hosted (e.g., "gitbook", "confluence"). */
  platform: z.string(),
  /** The reason why the LLM selected this document for an update. */
  reason: z.string(),
});

/**
 * Defines the schema for the expected LLM response, containing a list of routed documents.
 */
export const RoutedDocumentsResponseSchema = z.object({
  routedDocuments: z.array(RoutedDocumentSchema),
});

/**
 * Represents a document that has been selected by the LLM for an update.
 */
export type RoutedDocument = z.infer<typeof RoutedDocumentSchema>;

/**
 * Represents the expected LLM response, containing a list of routed documents.
 */
export type RoutedDocumentsResponse = z.infer<
  typeof RoutedDocumentsResponseSchema
>;
