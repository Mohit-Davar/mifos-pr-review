import * as core from "@actions/core";
import { generateDocumentEdits } from "@src/features/push/generator";
import { publishDocumentUpdate } from "@src/features/push/publisher";
import { retrieveDocumentContent } from "@src/features/push/retriever";
import { selectDocuments } from "@src/features/push/select-documents";
import { validateEdits } from "@src/features/push/validator";
import {
  expectError,
  getConfig,
  getPRContext,
  type PlatformCredentials,
} from "@src/shared";
import pLimit from "p-limit";

const DOC_CONCURRENCY = 3;
const limit = pLimit(DOC_CONCURRENCY);

/**
 * Orchestrates the entire documentation update workflow.
 * This function coordinates the process of collecting PR context, selecting relevant documents,
 * generating edits, validating them, and finally publishing the updates.
 *
 * @param params - The parameters required for the workflow.
 * @param params.credentials - Credentials for accessing documentation platforms.
 * @param params.owner - The owner of the repository.
 * @param params.prNumber - The pull request number.
 * @param params.repo - The repository name.
 * @param params.token - The GitHub token for the code repository.
 */
export async function handleMerge({
  credentials,
  owner,
  prNumber,
  repo,
  token,
}: {
  credentials: PlatformCredentials;
  owner: string;
  prNumber: number;
  repo: string;
  token: string;
}) {
  // Collect context from the pull request, including diff, commits, and metadata.
  const [collectorError, prContext] = await expectError(
    getPRContext({
      owner,
      prNumber,
      repo,
      token,
    })
  );
  if (collectorError) {
    throw new Error("Failed to collect pull request context", {
      cause: collectorError,
    });
  }

  // Load documentation sources from the configuration file.
  const config = getConfig();
  const sources = config.documentation?.documents;
  if (!sources?.length) {
    core.info(
      "No documentation sources are configured. Skipping documentation updates."
    );
    return;
  }

  // Use an LLM to select which documents are relevant to the merged changes.
  const [selectionError, selectedDocs] = await expectError(
    selectDocuments(prContext, sources, credentials)
  );
  if (selectionError) {
    throw new Error("Failed to select relevant documents", {
      cause: selectionError,
    });
  }
  if (selectedDocs.length === 0) {
    core.info("No documents were selected for update by the LLM.");
    return;
  }

  // Process each selected document concurrently.
  type ProcessResult =
    | {
        doc: (typeof selectedDocs)[number];
        status: "published";
        url: string;
      }
    | {
        doc: (typeof selectedDocs)[number];
        reason: string;
        status: "skipped";
      }
    | {
        doc: (typeof selectedDocs)[number];
        error: Error;
        status: "failed";
      };

  const results = await Promise.all(
    selectedDocs.map((doc) =>
      limit(async (): Promise<ProcessResult> => {
        try {
          core.info(`Processing: ${doc.path}`);
          // Retrieve current document.
          const [retrievalError, currentContent] = await expectError(
            retrieveDocumentContent(doc, credentials)
          );
          if (retrievalError) {
            throw new Error(`Failed to retrieve "${doc.path}".`, {
              cause: retrievalError,
            });
          }

          // Generate edits.
          const [generationError, edits] = await expectError(
            generateDocumentEdits(prContext, currentContent)
          );
          if (generationError) {
            throw new Error(`Failed to generate edits for "${doc.path}".`, {
              cause: generationError,
            });
          }
          if (edits.length === 0) {
            return {
              doc,
              reason: "No edits were generated.",
              status: "skipped",
            };
          }

          // Validate edits.
          const validation = validateEdits(
            currentContent,
            edits,
            prContext.diff
          );
          if (!validation.isValid || !validation.updatedContent) {
            return {
              doc,
              reason: validation.reason,
              status: "skipped",
            };
          }

          // Publish.
          const [publishError, url] = await expectError(
            publishDocumentUpdate({
              codeOwner: owner,
              codePrNumber: prNumber,
              codeRepo: repo,
              codeToken: token,
              credentials,
              routedDoc: doc,
              updatedContent: validation.updatedContent,
            })
          );
          if (publishError) {
            throw new Error(`Failed to publish "${doc.path}".`, {
              cause: publishError,
            });
          }
          return {
            doc,
            status: "published",
            url,
          };
        } catch (error) {
          return {
            doc,
            error: error as Error,
            status: "failed",
          };
        }
      })
    )
  );

  const published = results.filter(
    (result): result is Extract<ProcessResult, { status: "published" }> =>
      result.status === "published"
  );

  const skipped = results.filter(
    (result): result is Extract<ProcessResult, { status: "skipped" }> =>
      result.status === "skipped"
  );

  const failed = results.filter(
    (result): result is Extract<ProcessResult, { status: "failed" }> =>
      result.status === "failed"
  );

  core.info("");
  core.info("Documentation update summary");
  core.info("----------------------------");
  core.info(`Selected : ${selectedDocs.length}`);
  core.info(`Published: ${published.length}`);
  core.info(`Skipped  : ${skipped.length}`);
  core.info(`Failed   : ${failed.length}`);
  for (const result of published) {
    core.info(`✓ ${result.doc.path}`);
  }
  for (const result of skipped) {
    core.warning(`↷ ${result.doc.path}: ${result.reason}`);
  }
  for (const result of failed) {
    core.error(`✗ ${result.doc.path}: ${result.error.message}`);
    let currentCause = result.error.cause;
    while (currentCause) {
      const causeMessage =
        currentCause instanceof Error
          ? currentCause.message
          : String(currentCause);
      core.error(`  Cause: ${causeMessage}`);
      currentCause =
        currentCause instanceof Error ? currentCause.cause : undefined;
    }
  }
}
