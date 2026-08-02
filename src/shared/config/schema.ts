import { z } from "zod";

// Supported documentation audiences.
export const AudienceSchema = z.enum(["user", "implementor", "developer"]);

/** Fields shared by all documentation platforms. */
export const CommonDocumentSchema = {
  audience: AudienceSchema,
  enabled: z.boolean().optional().default(true),
  purpose: z.string(),
};

/** Fields used by platforms that synchronise documentation through GitHub. */
export const GitHubDocSchema = {
  branch: z.string(),
  path: z.string(),
  repo: z.string(),
};

/** GitBook page configuration. */
export const GitBookDocumentSchema = z.object({
  ...CommonDocumentSchema,
  ...GitHubDocSchema,
  platform: z.literal("gitbook"),
});

/** ReadMe page configuration. */
export const ReadMeDocumentSchema = z.object({
  ...CommonDocumentSchema,
  ...GitHubDocSchema,
  platform: z.literal("readme"),
});

/** Confluence page configuration. */
export const ConfluenceDocumentSchema = z
  .object({
    ...CommonDocumentSchema,
    pageId: z.string().optional(),
    platform: z.literal("confluence"),
    spaceKey: z.string().optional(),
  })
  .refine(
    (data) =>
      !!(data.pageId ?? data.spaceKey) && !(data.pageId && data.spaceKey),
    {
      message:
        "A Confluence source must specify exactly one of 'pageId' or 'spaceKey', not both.",
    }
  );

/** Union of all supported documentation platform schemas. */
export const DocumentSchema = z.discriminatedUnion("platform", [
  GitBookDocumentSchema,
  ReadMeDocumentSchema,
  ConfluenceDocumentSchema,
]);

/** Schema for the 'documentation' section of the config. */
export const DocumentationSchema = z.object({
  documents: z.array(DocumentSchema),
  enabled: z.boolean().optional().default(true),
});

/** Schema for file inclusion/exclusion in reviews. */
export const ReviewFilesSchema = z.object({
  exclude: z.array(z.string()).optional(),
  include: z.array(z.string()).optional(),
});

/** Schema for the 'security' section of a review. */
export const ReviewSecuritySchema = z.object({
  dependencyFiles: z.array(z.string()).optional(),
  rules: z.array(z.any()).optional(),
});

/** Schema for the 'review' section of the config. */
export const ReviewSchema = z.object({
  files: ReviewFilesSchema.optional(),
  model: z.string().optional(),
  security: ReviewSecuritySchema.optional(),
});

/**
 * Zod schema for the overall configuration file.
 */
export const ConfigSchema = z.object({
  documentation: DocumentationSchema.optional(),
  review: ReviewSchema.optional(),
});
