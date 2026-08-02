import { z } from "zod";

/**
 * Defines the schema for a document that has been selected by the LLM for an update.
 */
export const RoutedDocumentSchema = z.object({
  /** The branch of the repository to read from and create a PR against. */
  branch: z.string(),
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

/**
 * A cached directory or page listing.
 */
export interface CacheEntry {
  /** Cached file or page entries. */
  files: string[];
  /** Unix timestamp (milliseconds) when the entry was cached. */
  timestamp: number;
}

/**
 * Root structure of the on-disk cache file.
 */
export interface CacheData {
  /** Cached listings indexed by a unique cache key. */
  listings: Record<string, CacheEntry>;
}
