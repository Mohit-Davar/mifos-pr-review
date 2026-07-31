import { publishConfluenceUpdate } from "@src/features/push/publisher";
import { publishGitHubUpdate } from "@src/features/push/publisher";
import type { RoutedDocument } from "@src/features/push/select-documents";
import type { PlatformCredentials } from "@src/shared";

/**
 * Orchestrates the publishing of document updates to the appropriate platform.
 * It routes the request to the correct publisher (e.g., GitHub, Confluence) based on the
 * document's specified platform.
 *
 * @param params - The parameters for publishing the document update.
 * @param params.codeOwner - The owner of the original code repository.
 * @param params.codePrNumber - The number of the original pull request.
 * @param params.codeRepo - The name of the original code repository.
 * @param params.codeToken - The GitHub token for the code repository.
 * @param params.credentials - The credentials for all configured documentation platforms.
 * @param params.routedDoc - The document that was selected for an update.
 * @param params.updatedContent - The new, updated content for the document.
 * @returns A promise that resolves to the URL of the created PR or comment.
 * @throws An error if the platform is unsupported or if required credentials are missing.
 */
export async function publishDocumentUpdate({
  codeOwner,
  codePrNumber,
  codeRepo,
  codeToken,
  credentials,
  routedDoc,
  updatedContent,
}: {
  codeOwner: string;
  codePrNumber: number;
  codeRepo: string;
  codeToken: string;
  credentials: PlatformCredentials;
  routedDoc: RoutedDocument;
  updatedContent: string;
}): Promise<string> {
  const platform = routedDoc.platform.toLowerCase();

  if (platform.includes("gitbook") || platform.includes("readme")) {
    const token = credentials.docsGithubToken;
    if (!token) {
      throw new Error(
        `Missing docsGithubToken for platform ${routedDoc.platform}`
      );
    }
    return publishGitHubUpdate({
      codeOwner,
      codePrNumber,
      codeRepo,
      docsGithubToken: token,
      path: routedDoc.path,
      reason: routedDoc.reason,
      updatedContent,
    });
  } else if (platform.includes("confluence")) {
    const confluenceBaseUrl = credentials.confluence?.baseUrl
      ? credentials.confluence.baseUrl.replace(/\/$/, "")
      : "https://confluence.atlassian.net";

    const confluenceUsername = credentials.confluence?.username;
    const confluenceApiToken = credentials.confluence?.apiToken;

    if (!confluenceUsername || !confluenceApiToken) {
      throw new Error("Missing Confluence credentials username or apiToken.");
    }

    return publishConfluenceUpdate({
      codeOwner,
      codePrNumber,
      codeRepo,
      codeToken,
      confluenceBaseUrl,
      pageId: routedDoc.path,
      reason: routedDoc.reason,
      updatedContent,
    });
  } else {
    throw new Error(`Unsupported platform: ${routedDoc.platform}`);
  }
}
