import type {
  ConfluenceDocument,
  ConfluencePageResponse,
  ConfluenceSpacePagesResponse,
} from "@src/features/push/retriever";

/**
 * Retrieves a Confluence page in storage format using the Confluence Cloud REST API v2.
 *
 * @param pageId - Confluence page ID.
 * @param baseUrl - Base URL of the Confluence instance (for example, `https://example.atlassian.net`).
 * @param username - Email address used for Confluence authentication.
 * @param apiToken - Confluence API token.
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

/**
 * Lists pages within a Confluence space using the Confluence Cloud REST API v2.
 *
 * Pages are returned as `{ id, title }` pairs so the LLM can route to specific
 * pages rather than the space itself. Results are fetched using cursor-based
 * pagination until all pages have been retrieved or `maxPages` has been reached.
 *
 * @param spaceKey - Confluence space key (for example, `"DOCS"`).
 * @param baseUrl - Base URL of the Confluence instance.
 * @param username - Email address used for Confluence authentication.
 * @param apiToken - Confluence API token.
 * @param maxPages - Maximum number of pages to retrieve. Defaults to `200`.
 * @returns A list of page IDs and titles.
 * @throws If the request fails or the response is invalid.
 */
export async function listConfluenceSpacePages(
  spaceKey: string,
  baseUrl: string,
  username: string,
  apiToken: string,
  maxPages = 200
): Promise<Array<{ id: string; title: string }>> {
  const PAGE_SIZE = 100;

  const auth = Buffer.from(`${username}:${apiToken}`).toString("base64");

  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${auth}`,
  };

  const pages: Array<{ id: string; title: string }> = [];

  const initialUrl = new URL(`/wiki/api/v2/spaces/${spaceKey}/pages`, baseUrl);
  initialUrl.searchParams.set("limit", PAGE_SIZE.toString());

  let nextPageUrl: string | null = initialUrl.toString();

  while (nextPageUrl && pages.length < maxPages) {
    const response = await fetch(nextPageUrl, {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");

      throw new Error(
        `Failed to list pages for Confluence space "${spaceKey}". ` +
          `Status: ${response.status} ${response.statusText}${
            details ? ` - ${details}` : ""
          }`
      );
    }

    const result = (await response.json()) as ConfluenceSpacePagesResponse;

    for (const page of result.results ?? []) {
      pages.push({
        id: page.id,
        title: page.title,
      });

      if (pages.length >= maxPages) {
        break;
      }
    }

    // Continue with the next cursor, if available.
    nextPageUrl = result._links?.next
      ? new URL(result._links.next, baseUrl).toString()
      : null;
  }

  return pages;
}
