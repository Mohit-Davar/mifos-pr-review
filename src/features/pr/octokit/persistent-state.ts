import { getOctokit } from "@actions/github";
import type { StoredReviewState } from "@src/features/pr/compare-state";
import type { LoadedReviewState } from "@src/features/pr/octokit";

// Visible marker used to find the summary comment.
export const SUMMARY_MARKER = "<!-- summary -->";
// Hidden block used to store review state inside the summary comment.
const STATE_BLOCK_START = "<!-- state";
const STATE_BLOCK_END = "-->";
// Empty state used on the first run or when state cannot be loaded.
export const EMPTY_STATE: StoredReviewState = {
  findings: [],
  version: 1,
};

/**
 * Read the hidden state block from a summary comment.
 *
 * @param commentBody - The raw body text of the comment.
 * @returns The parsed state object, or null if loading fails.
 *
 * @remarks
 * This function locates the hidden block markers, extracts the Base64 payload,
 * decodes it, and validates the schema version before returning.
 */
export function decodeState(commentBody: string): StoredReviewState | null {
  try {
    const stateBlockStartIndex = commentBody.indexOf(STATE_BLOCK_START);
    if (stateBlockStartIndex === -1) {
      return null;
    }
    // The encoded state starts on the line after the opening marker.
    const encodedStateStartIndex =
      commentBody.indexOf("\n", stateBlockStartIndex) + 1;
    const stateBlockEndIndex = commentBody.indexOf(
      STATE_BLOCK_END,
      encodedStateStartIndex
    );
    if (stateBlockEndIndex === -1) {
      return null;
    }

    // Extract the Base64-encoded state.
    const encodedState = commentBody
      .slice(encodedStateStartIndex, stateBlockEndIndex)
      .trim();
    // Decode Base64 back into JSON.
    const decodedStateJson = Buffer.from(encodedState, "base64").toString(
      "utf-8"
    );
    // Parse the JSON into our state object.
    const parsedState = JSON.parse(decodedStateJson) as StoredReviewState;
    // Validate the expected shape.
    if (parsedState.version !== 1 || !Array.isArray(parsedState.findings)) {
      return null;
    }

    return parsedState;
  } catch {
    return null;
  }
}

/**
 * Convert state into a Base64 block that can be embedded in the PR comment.
 *
 * @param state - The state object to encode.
 * @returns An HTML comment block containing the encoded state string.
 *
 * @remarks
 * Encodes the string to Base64 to ensure markdown format integrity is maintained.
 */
export function encodeState(state: StoredReviewState): string {
  const serializedState = JSON.stringify(state);
  const encodedState = Buffer.from(serializedState, "utf-8").toString("base64");

  return ["", STATE_BLOCK_START, encodedState, STATE_BLOCK_END].join("\n");
}

/**
 * Load the previous state from the PR summary comment.
 *
 * @param token - The GitHub token.
 * @param owner - The owner of the repository.
 * @param repo - The name of the repository.
 * @param pullNumber - The pull request number.
 * @returns The loaded state and the associated comment.
 *
 * @remarks
 * Queries the GitHub API for comments, searches for the marker string, and returns
 * the decoded payload or an empty default state.
 */
export async function loadState(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<LoadedReviewState> {
  const octokit = getOctokit(token);
  // Fetch all issue comments on the pull request.
  const { data: issueComments } = await octokit.rest.issues.listComments({
    issue_number: pullNumber,
    owner,
    per_page: 100,
    repo,
  });
  // Find the summary comment.
  const summaryComment = issueComments.find((comment) =>
    comment.body?.includes(SUMMARY_MARKER)
  );
  if (!summaryComment?.body) {
    return {
      state: EMPTY_STATE,
      summaryCommentId: null,
    };
  }

  return {
    state: decodeState(summaryComment.body) ?? EMPTY_STATE,
    summaryCommentId: summaryComment.id,
  };
}
