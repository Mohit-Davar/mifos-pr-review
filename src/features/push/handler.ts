import * as core from "@actions/core";
import { generateDocumentEdits } from "@src/features/push/generator";
import { collectPRContext } from "@src/features/push/octokit";
import { publishDocumentUpdate } from "@src/features/push/publisher";
import { retrieveDocumentContent } from "@src/features/push/retriever";
import { selectDocuments } from "@src/features/push/select-documents";
import { applyAndValidateEdits } from "@src/features/push/validator";
import { expectError, getConfig, type PlatformCredentials } from "@src/shared";
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
    collectPRContext({ owner, prNumber, repo, token })
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
    selectDocuments(prContext, sources, credentials.docsGithubToken)
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
  type ProcessResult = {
    doc: (typeof selectedDocs)[number];
    error?: Error;
  };
  const processingPromises = selectedDocs.map((doc) =>
    limit(async (): Promise<ProcessResult> => {
      try {
        core.info(
          `Processing selected document: ${doc.path} (${doc.platform})`
        );
        // Retrieve the current content.
        const [retrieverError, currentContent] = await expectError(
          retrieveDocumentContent(doc, credentials)
        );
        if (retrieverError) {
          throw new Error(`Failed to retrieve content for ${doc.path}`, {
            cause: retrieverError,
          });
        }
        // Generate edits.
        const [generatorError, edits] = await expectError(
          generateDocumentEdits(prContext, currentContent)
        );
        if (generatorError) {
          throw new Error(`Failed to generate edits for ${doc.path}`, {
            cause: generatorError,
          });
        }
        if (edits.length === 0) {
          core.info(`No edits were generated for ${doc.path}.`);
          return { doc };
        }
        // Validate edits.
        const validationResult = applyAndValidateEdits(
          currentContent,
          edits,
          prContext.diff
        );
        if (!validationResult.isValid || !validationResult.updatedContent) {
          core.warning(
            `Validation failed for ${doc.path}: ${validationResult.reason}. Skipping publication.`
          );
          return { doc };
        }
        // Publish the updated document.
        const [publishError, url] = await expectError(
          publishDocumentUpdate({
            codeOwner: owner,
            codePrNumber: prNumber,
            codeRepo: repo,
            codeToken: token,
            credentials,
            routedDoc: doc,
            updatedContent: validationResult.updatedContent,
          })
        );
        if (publishError) {
          throw new Error(`Failed to publish update for ${doc.path}`, {
            cause: publishError,
          });
        }
        core.info(`Successfully published update for ${doc.path}: ${url}`);
        return { doc };
      } catch (err) {
        return { doc, error: err as Error };
      }
    })
  );

  const results = await Promise.all(processingPromises);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    core.error(`Failed to process ${failed.length} document(s):`);
    for (const { doc, error } of failed) {
      core.error(`- ${doc.path}: ${error?.message}`);
    }
  }
}
