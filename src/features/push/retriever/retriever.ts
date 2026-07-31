import {
  retrieveConfluenceContent,
  retrieveGitHubContent,
} from "@src/features/push/retriever";
import type { RoutedDocument } from "@src/features/push/select-documents";
import { expectError, type PlatformCredentials } from "@src/shared";

/**
 * Retrieves the content of a routed documentation file from the appropriate platform.
 *
 * All routed documents are expected to point to specific files (not directories).
 * Directory-to-file resolution is handled upstream by {@link selectDocuments}, which
 * pre-fetches directory listings and passes them to the LLM for precise file selection.
 *
 * @param doc - Routed document containing the platform and file path.
 * @param credentials - Credentials for the supported documentation platforms.
 * @returns The retrieved document content as a string.
 * @throws If the platform is unsupported, credentials are missing, or the fetch fails.
 */
export async function retrieveDocumentContent(
  doc: RoutedDocument,
  credentials: PlatformCredentials
): Promise<string> {
  const platform = doc.platform.toLowerCase();

  if (platform.includes("github")) {
    const token = credentials.docsGithubToken;
    if (!token) {
      throw new Error("Missing docsGithubToken.");
    }
    const [err, content] = await expectError(
      retrieveGitHubContent(doc.path, token)
    );
    if (err) {
      throw new Error(`Failed to retrieve GitHub content for ${doc.path}`, {
        cause: err,
      });
    }
    return content;
  }

  if (platform.includes("confluence")) {
    const confluence = credentials.confluence;
    if (!confluence?.baseUrl || !confluence.username || !confluence.apiToken) {
      throw new Error("Missing Confluence credentials.");
    }
    const [err, result] = await expectError(
      retrieveConfluenceContent(
        doc.path,
        confluence.baseUrl,
        confluence.username,
        confluence.apiToken
      )
    );
    if (err) {
      throw new Error(`Failed to retrieve Confluence content for ${doc.path}`, {
        cause: err,
      });
    }
    return result.content;
  }

  throw new Error(`Unsupported documentation platform: ${doc.platform}`);
}
