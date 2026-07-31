import { getOctokit } from "@actions/github";
import {
  decodeState,
  EMPTY_STATE,
  encodeState,
  loadState,
  type StoredFinding,
  type StoredReviewState,
  SUMMARY_MARKER,
} from "@src/features/pr/octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock GitHub API so no real network calls happen.
// We fully control its behavior in each test.
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
}));

describe("decodeState", () => {
  it("returns null when there is no hidden state in the comment", () => {
    expect(decodeState("just a regular PR comment")).toBeNull();
  });

  it("returns null when state block is started but not closed properly", () => {
    const body = `${SUMMARY_MARKER}\n<!-- state\nincomplete-data`;
    expect(decodeState(body)).toBeNull();
  });

  it("returns null when the encoded data is not valid base64", () => {
    const body = `${SUMMARY_MARKER}\n<!-- state\n!!!invalid-data!!!\n-->`;
    expect(decodeState(body)).toBeNull();
  });

  it("returns null when decoded data is not valid JSON", () => {
    const garbage = Buffer.from("not-json", "utf-8").toString("base64");
    const body = `${SUMMARY_MARKER}\n<!-- state\n${garbage}\n-->`;
    expect(decodeState(body)).toBeNull();
  });

  it("returns null when state version is not supported", () => {
    const state = { findings: [], version: 2 };
    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
    const body = `${SUMMARY_MARKER}\n<!-- state\n${encoded}\n-->`;
    expect(decodeState(body)).toBeNull();
  });

  it("returns null when findings is not a list", () => {
    const state = { findings: "invalid", version: 1 };
    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
    const body = `${SUMMARY_MARKER}\n<!-- state\n${encoded}\n-->`;
    expect(decodeState(body)).toBeNull();
  });

  it("returns null when version field is missing", () => {
    const state = { findings: [] };
    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
    const body = `${SUMMARY_MARKER}\n<!-- state\n${encoded}\n-->`;
    expect(decodeState(body)).toBeNull();
  });

  it("returns null for empty comment body", () => {
    expect(decodeState("")).toBeNull();
  });

  it("correctly reads valid stored state from a comment", () => {
    const state: StoredReviewState = {
      findings: [{ id: "abc" } as unknown as StoredFinding],
      version: 1,
    };

    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
    const body = `${SUMMARY_MARKER}\nSummary text\n<!-- state\n${encoded}\n-->`;

    expect(decodeState(body)).toEqual(state);
  });

  it("finds state even if mixed with other comments or markdown", () => {
    const state: StoredReviewState = { findings: [], version: 1 };
    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");

    const body = [
      "## Summary",
      SUMMARY_MARKER,
      "<!-- random note -->",
      `<!-- state\n${encoded}\n-->`,
    ].join("\n");

    expect(decodeState(body)).toEqual(state);
  });

  it("does not break when closing marker appears in normal text", () => {
    const state: StoredReviewState = {
      findings: [{ id: "x" } as unknown as StoredFinding],
      version: 1,
    };

    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
    const body = `${SUMMARY_MARKER}\n<!-- state\n${encoded}\n-->\nextra --> text`;

    expect(decodeState(body)).toEqual(state);
  });

  it("ignores extra spaces around encoded data", () => {
    const state: StoredReviewState = { findings: [], version: 1 };
    const encoded = Buffer.from(JSON.stringify(state)).toString("base64");
    const body = `<!-- state\n   ${encoded}   \n-->`;

    expect(decodeState(body)).toEqual(state);
  });
});

describe("encodeState", () => {
  it("creates a structured hidden state block", () => {
    const block = encodeState(EMPTY_STATE);

    const lines = block.split("\n");
    expect(lines[1]).toBe("<!-- state");
    expect(lines[3]).toBe("-->");
  });

  it("can encode and decode state without losing data", () => {
    const state: StoredReviewState = {
      findings: [
        { id: "1", status: "new" } as unknown as StoredFinding,
        { id: "2", status: "fixed" } as unknown as StoredFinding,
      ],
      version: 1,
    };

    const block = encodeState(state);
    expect(decodeState(block)).toEqual(state);
  });
});

describe("encodeState / decodeState round-trip", () => {
  it("state survives encode → embed → decode flow", () => {
    const samples: StoredReviewState[] = [
      EMPTY_STATE,
      { findings: [{ id: "a" } as unknown as StoredFinding], version: 1 },
      {
        findings: Array.from({ length: 20 }, (_, i) => ({
          id: `item-${i}`,
        })) as unknown as StoredFinding[],
        version: 1,
      },
    ];

    for (const state of samples) {
      const body = `${SUMMARY_MARKER}\n${encodeState(state)}`;
      expect(decodeState(body)).toEqual(state);
    }
  });
});

describe("loadState", () => {
  const listComments = vi.fn();

  beforeEach(() => {
    listComments.mockReset();
    (getOctokit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      rest: { issues: { listComments } },
    });
  });

  it("returns empty state when there are no comments", async () => {
    listComments.mockResolvedValue({ data: [] });

    const result = await loadState("token", "owner", "repo", 1);

    expect(result).toEqual({ state: EMPTY_STATE, summaryCommentId: null });
  });

  it("returns empty state when no comment contains saved state", async () => {
    listComments.mockResolvedValue({
      data: [{ body: "hello" }, { body: "world" }],
    });

    const result = await loadState("token", "owner", "repo", 1);

    expect(result.summaryCommentId).toBeNull();
    expect(result.state).toEqual(EMPTY_STATE);
  });

  it("finds the correct comment that contains saved state", async () => {
    const state: StoredReviewState = {
      findings: [{ id: "x" } as unknown as StoredFinding],
      version: 1,
    };

    const body = `${SUMMARY_MARKER}${encodeState(state)}`;

    listComments.mockResolvedValue({
      data: [
        { body: "ignore", id: 1 },
        { body, id: 99 },
        { body: "ignore too", id: 2 },
      ],
    });

    const result = await loadState("token", "owner", "repo", 1);

    expect(result.summaryCommentId).toBe(99);
    expect(result.state).toEqual(state);
  });

  it("keeps comment ID even if stored state is broken", async () => {
    listComments.mockResolvedValue({
      data: [{ body: `${SUMMARY_MARKER}\n<!-- state\nbroken\n-->`, id: 10 }],
    });

    const result = await loadState("token", "owner", "repo", 1);

    expect(result.summaryCommentId).toBe(10);
    expect(result.state).toEqual(EMPTY_STATE);
  });

  it("treats empty comment body as invalid", async () => {
    listComments.mockResolvedValue({ data: [{ body: "", id: 5 }] });

    const result = await loadState("token", "owner", "repo", 1);

    expect(result).toEqual({ state: EMPTY_STATE, summaryCommentId: null });
  });

  it("calls GitHub API with correct inputs", async () => {
    listComments.mockResolvedValue({ data: [] });

    await loadState("token", "owner", "repo", 42);

    expect(getOctokit).toHaveBeenCalledWith("token");

    expect(listComments).toHaveBeenCalledWith({
      issue_number: 42,
      owner: "owner",
      per_page: 100,
      repo: "repo",
    });
  });
});
