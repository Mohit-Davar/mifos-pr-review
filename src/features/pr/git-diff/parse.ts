import parseDiff from "parse-diff";

import type { Change, ParsedFileDiff } from "@src/features/pr/git-diff/types";

export function parseGitDiff(diff: string): ParsedFileDiff[] {
  const files = parseDiff(diff);

  return files.map((file) => {
    const added: Change[] = [];
    const removed: Change[] = [];

    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.type === "add") {
          added.push({
            content: change.content.substring(1),
            lineNumber: change.ln,
          });
        }

        if (change.type === "del") {
          removed.push({
            content: change.content.substring(1),
            lineNumber: change.ln,
          });
        }
      }
    }

    return {
      file: file.to ?? file.from ?? "unknown",
      added,
      removed,
    };
  });
}
