import { getOctokit } from "@actions/github";

/**
 * Publishes document updates to a GitHub repository by creating a new branch and opening a pull request.
 * This function handles both single-file and multi-file (folder) updates.
 *
 * @param params - The parameters for publishing the GitHub update.
 * @param params.codeOwner - The owner of the original code repository.
 * @param params.codePrNumber - The number of the original pull request.
 * @param params.codeRepo - The name of the original code repository.
 * @param params.docsGithubToken - The GitHub token for accessing the documentation repository.
 * @param params.path - The path to the document or folder in the format `/owner/repo/filepath`.
 * @param params.reason - The reason the document was selected for an update.
 * @param params.updatedContent - The new content for the document(s).
 * @returns A promise that resolves to the URL of the created pull request.
 * @throws An error if the path format is invalid or if the update process fails.
 */
export async function publishGitHubUpdate({
  codeOwner,
  codePrNumber,
  codeRepo,
  docsGithubToken,
  path,
  reason,
  updatedContent,
}: {
  codeOwner: string;
  codePrNumber: number;
  codeRepo: string;
  docsGithubToken: string;
  path: string;
  reason: string;
  updatedContent: string;
}): Promise<string> {
  const octokit = getOctokit(docsGithubToken);

  // The path is expected in the format /owner/repo/filepath.
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      `Invalid path format for git platform: ${path}. Expected /owner/repo/filepath`
    );
  }

  const owner = parts[0]!;
  const repo = parts[1]!;
  const targetPath = parts.slice(2).join("/");

  // Get the default branch of the documentation repository.
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const baseBranch = repoData.default_branch || "main";

  // Get the SHA of the latest commit on the default branch.
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    ref: `heads/${baseBranch}`,
    repo,
  });
  const baseSha = refData.object.sha;

  // Create a new branch from the base SHA to commit the changes.
  const newBranchName = `prowl/docs-update-pr-${codePrNumber}-${Date.now()}`;
  await octokit.rest.git.createRef({
    owner,
    ref: `refs/heads/${newBranchName}`,
    repo,
    sha: baseSha,
  });

  // Get the content at the target path to determine if it's a file or folder.
  const contentResponse = await octokit.rest.repos.getContent({
    owner,
    path: targetPath,
    ref: newBranchName,
    repo,
  });

  const isFolder = Array.isArray(contentResponse.data);
  const updatedFilePaths: string[] = [];

  if (isFolder) {
    // If it's a folder, parse the multi-file content format.
    // The format is `--- File: path/to/file ---\n<content>`.
    const fileMarkerRegex =
      /--- File: (.*?) ---\n([\s\S]*?)(?=(?:\n--- File:|$))/g;
    let match;
    const fileUpdates: { content: string; filePath: string }[] = [];

    while ((match = fileMarkerRegex.exec(updatedContent)) !== null) {
      const filePath = match[1]!.trim();
      const content = match[2]!;
      fileUpdates.push({ content, filePath });
    }

    if (fileUpdates.length === 0) {
      throw new Error(
        "Failed to parse file updates from folder content representation."
      );
    }

    // Commit updates for each file.
    for (const update of fileUpdates) {
      // Get the file's current SHA to perform an update.
      let fileSha: string | undefined;
      try {
        const fileResponse = await octokit.rest.repos.getContent({
          owner,
          path: update.filePath,
          ref: newBranchName,
          repo,
        });
        if (
          !Array.isArray(fileResponse.data) &&
          fileResponse.data.type === "file"
        ) {
          fileSha = fileResponse.data.sha;
        }
      } catch {
        // If the file doesn't exist, it will be created.
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        branch: newBranchName,
        content: Buffer.from(update.content).toString("base64"),
        message: `docs: update documentation for ${update.filePath} [skip ci]`,
        owner,
        path: update.filePath,
        repo,
        sha: fileSha,
      });

      updatedFilePaths.push(update.filePath);
    }
  } else {
    // If it's a single file, commit the update directly.
    // At this point `contentResponse.data` is not an array, so we can treat it as a file object.
    interface GitHubFileContent {
      sha: string;
      type: "file" | "symlink" | "submodule" | "dir";
      // Additional fields are present but not needed for this logic.
    }
    const fileData = contentResponse.data as GitHubFileContent;
    if (fileData.type !== "file" || !("sha" in fileData)) {
      throw new Error(`Path ${targetPath} is not a valid file for update.`);
    }
    const fileSha = fileData.sha;

    await octokit.rest.repos.createOrUpdateFileContents({
      branch: newBranchName,
      content: Buffer.from(updatedContent).toString("base64"),
      message: `docs: update documentation for ${targetPath} [skip ci]`,
      owner,
      path: targetPath,
      repo,
      sha: fileSha,
    });

    updatedFilePaths.push(targetPath);
  }

  const prTitle = `docs: update documentation for PR #${codePrNumber}`;

  const fileSection =
    updatedFilePaths.length === 1
      ? `**File:** \`${updatedFilePaths[0]}\``
      : `**Files:**\n${updatedFilePaths.map((f) => `- \`${f}\``).join("\n")}`;

  const prBody = [
    `## Documentation update`,
    ``,
    `Triggered by [PR #${codePrNumber}](https://github.com/${codeOwner}/${codeRepo}/pull/${codePrNumber}) in [${codeOwner}/${codeRepo}](https://github.com/${codeOwner}/${codeRepo}).`,
    ``,
    fileSection,
    `**Reason:** ${reason}`,
    ``,
    `### Review`,
    ``,
    `- [ ] Changes are accurate and reflect the code diff`,
    `- [ ] Formatting and tone match existing docs`,
    `- [ ] No unrelated sections touched`,
    ``,
    `---`,
    ``,
    `*Opened automatically by RepoOwl.*`,
  ].join("\n");

  const { data: prResponse } = await octokit.rest.pulls.create({
    base: baseBranch,
    body: prBody,
    head: newBranchName,
    owner,
    repo,
    title: prTitle,
  });

  return prResponse.html_url;
}
