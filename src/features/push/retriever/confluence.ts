import type {
  ConfluenceDocument,
  ConfluencePageResponse,
} from "@src/features/push/retriever";

/**
 * Retrieves a Confluence page in storage format using the Confluence Cloud REST API v2.
 *
 * @param pageId - The Confluence page ID.
 * @param baseUrl - The base URL of the Confluence instance (e.g. https://example.atlassian.net).
 * @param username - The email address used for Confluence authentication.
 * @param apiToken - The Confluence API token.
 * @returns The page content and associated metadata.
 * @throws If the request fails or the response is invalid.
 */
export async function retrieveConfluenceContent(
  pageId: string,
  baseUrl: string,
  username: string,
  apiToken: string
): Promise<ConfluenceDocument> {
  const url = new URL(`/wiki/api/v2/pages/${pageId}`, baseUrl);
  url.searchParams.set("body-format", "storage");
  const auth = Buffer.from(`${username}:${apiToken}`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
    method: "GET",
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Failed to retrieve Confluence page "${pageId}". ` +
        `Status: ${response.status} ${response.statusText}${
          details ? ` - ${details}` : ""
        }`
    );
  }
  const data = (await response.json()) as ConfluencePageResponse;
  if (!data.body?.storage?.value) {
    throw new Error(
      `Confluence page "${pageId}" does not contain storage-format content.`
    );
  }
  if (data.version?.number == null) {
    throw new Error(
      `Confluence page "${pageId}" does not include version information.`
    );
  }

  return {
    content: data.body.storage.value,
    id: data.id,
    title: data.title,
    updatedAt: data.version.createdAt,
    version: data.version.number,
    webUrl: data._links?.webui
      ? new URL(data._links.webui, baseUrl).toString()
      : undefined,
  };
}
