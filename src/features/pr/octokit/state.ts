import { getOctokit } from "@actions/github";
import type {
  LoadedState,
  PersistedState,
} from "@src/features/pr/octokit/types";

export const SUMMARY_MARKER = "<!-- summary -->";
const STATE_OPEN = "<!-- state";
const STATE_CLOSE = "-->";

export const EMPTY_STATE: PersistedState = { findings: [], version: 1 };

// Encode state for storage in the summary comment.
export function encodeState(state: PersistedState): string {
  const serializedState = JSON.stringify(state);
  const encodedState = Buffer.from(serializedState, "utf-8").toString("base64");

  return ["", STATE_OPEN, encodedState, STATE_CLOSE].join("\n");
}

// Decode and validate stored state from the comment body.
function decodeState(body: string): PersistedState | null {
  try {
    const stateStart = body.indexOf(STATE_OPEN);
    if (stateStart === -1) {
      return null;
    }

    const contentStart = body.indexOf("\n", stateStart) + 1;
    const stateEnd = body.indexOf(STATE_CLOSE, contentStart);
    if (stateEnd === -1) {
      return null;
    }

    const encodedState = body.slice(contentStart, stateEnd).trim();

    const decodedState = Buffer.from(encodedState, "base64").toString("utf-8");

    const state = JSON.parse(decodedState) as PersistedState;

    if (state.version !== 1 || !Array.isArray(state.findings)) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

// Remove the hidden state block from a comment body.
export function stripStateBlock(body: string): string {
  const stateStart = body.indexOf(STATE_OPEN);
  if (stateStart === -1) {
    return body;
  }

  return body.slice(0, stateStart).trimEnd();
}

// Load saved state from the PR summary comment. Returns empty state if not found.
export async function loadState(
  token: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<LoadedState> {
  const octokit = getOctokit(token);

  const { data: comments } = await octokit.rest.issues.listComments({
    issue_number: pullNumber,
    owner,
    per_page: 100,
    repo,
  });

  const summaryComment = comments.find((comment) =>
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
