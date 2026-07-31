import { getOctokit } from "@actions/github";

/**
 * Publishes a Confluence documentation update by posting a comment on the source pull request.
 * This approach is designed to be non-intrusive, suggesting changes rather than overwriting
 * enterprise wikis directly. It provides the updated content in a code block for easy review and manual application.
 *
 * @param params - The parameters for publishing the Confluence update suggestion.
 * @param params.codeOwner - The owner of the code repository.
 * @param params.codePrNumber - The number of the pull request where changes originated.
 * @param params.codeRepo - The name of the code repository.
 * @param params.codeToken - The GitHub token for accessing the code repository.
 * @param params.confluenceBaseUrl - The base URL of the Confluence instance.
 * @param params.pageId - The ID of the Confluence page to be updated.
 * @param params.reason - The reason the document was selected for an update.
 * @param params.updatedContent - The new, updated content for the Confluence page.
 * @returns A promise that resolves to the URL of the created comment.
 */
export async function publishConfluenceUpdate({
  codeOwner,
  codePrNumber,
  codeRepo,
  codeToken,
  confluenceBaseUrl,
  pageId,
  reason,
  updatedContent,
}: {
  codeOwner: string;
  codePrNumber: number;
  codeRepo: string;
  codeToken: string;
  confluenceBaseUrl: string;
  pageId: string;
  reason: string;
  updatedContent: string;
}): Promise<string> {
  const codeOctokit = getOctokit(codeToken);
  const normalizedBaseUrl = confluenceBaseUrl.replace(/\/$/, "");
  const confluencePageUrl = `${normalizedBaseUrl}/wiki/pages/viewpage.action?pageId=${pageId}`;

  const commentBody = [
    `## Documentation update suggested`,
    ``,
    `Triggered by [PR #${codePrNumber}](https://github.com/${codeOwner}/${codeRepo}/pull/${codePrNumber}) in [${codeOwner}/${codeRepo}](https://github.com/${codeOwner}/${codeRepo}).`,
    ``,
    `**Confluence page:** [${pageId}](${confluencePageUrl})`,
    `**Reason:** ${reason}`,
    ``,
    `<details>`,
    `<summary><strong>Proposed content</strong></summary>`,
    ``,
    `\`\`\`html`,
    updatedContent,
    `\`\`\``,
    ``,
    `</details>`,
    ``,
    `### Next steps`,
    ``,
    `1. Review the proposed content above.`,
    `2. Open the [Confluence page](${confluencePageUrl}).`,
    `3. Apply the changes, or paste the block directly into the page editor.`,
    ``,
    `---`,
    ``,
    `*Opened automatically by RepoOwl.*`,
  ].join("\n");

  const { data: commentResponse } = await codeOctokit.rest.issues.createComment(
    {
      body: commentBody,
      issue_number: codePrNumber,
      owner: codeOwner,
      repo: codeRepo,
    }
  );

  return commentResponse.html_url;
}

/**
 * This is an optional helper function that can be used if direct updates are desired.
 * It fetches the current page version, increments it, and then PUTs the new content.
 *
 * @param params - The parameters for directly updating the Confluence page.
 * @param params.apiToken - The Confluence API token.
 * @param params.baseUrl - The base URL of the Confluence instance.
 * @param params.markdownContent - The new content in Markdown format.
 * @param params.pageId - The ID of the page to update.
 * @param params.username - The Confluence username for authentication.
 * @throws An error if fetching the page or updating it fails.
 */
export async function updateConfluencePageDirectly({
  apiToken,
  baseUrl,
  markdownContent,
  pageId,
  username,
}: {
  apiToken: string;
  baseUrl: string;
  markdownContent: string;
  pageId: string;
  username: string;
}): Promise<void> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${username}:${apiToken}`).toString("base64");

  // Fetch the current page version and title to ensure a safe update.
  const getResponse = await fetch(
    `${normalizedBaseUrl}/wiki/api/v2/pages/${pageId}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      method: "GET",
    }
  );

  if (!getResponse.ok) {
    throw new Error(
      `Failed to fetch current Confluence page version. Status: ${getResponse.status}`
    );
  }

  const pageData = (await getResponse.json()) as {
    title: string;
    version?: {
      number?: number;
    };
  };

  const currentVersion = pageData.version?.number ?? 1;
  const pageTitle = pageData.title;

  // Wrap the Markdown content in Confluence's storage format using a macro.
  const storageValue = `<ac:structured-macro ac:name="markdown" ac:schema-version="1">\n  <ac:plain-text-body><![CDATA[${markdownContent}]]></ac:plain-text-body>\n</ac:structured-macro>`;

  // Send the updated content via a PUT request, incrementing the page version.
  const putResponse = await fetch(
    `${normalizedBaseUrl}/wiki/api/v2/pages/${pageId}`,
    {
      body: JSON.stringify({
        body: {
          representation: "storage",
          value: storageValue,
        },
        id: pageId,
        status: "current",
        title: pageTitle,
        version: {
          number: currentVersion + 1,
        },
      }),
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      method: "PUT",
    }
  );

  if (!putResponse.ok) {
    const details = await putResponse.text().catch(() => "");
    throw new Error(
      `Failed to update Confluence page. Status: ${putResponse.status}. Details: ${details}`
    );
  }
}
