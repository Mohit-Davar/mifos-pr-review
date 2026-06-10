import type { Change, ParsedFileDiff } from "@src/features/pr/git-diff";
import parseDiff from "parse-diff";

export function parseGitDiff(diff: string): ParsedFileDiff[] {
  const parsedFiles = parseDiff(diff);

  return parsedFiles.map((file) => {
    const added: Change[] = [];
    const removed: Change[] = [];

    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        switch (change.type) {
          case "add":
            added.push({
              content: change.content.slice(1),
              lineNumber: change.ln,
            });
            break;
          case "del":
            removed.push({
              content: change.content.slice(1),
              lineNumber: change.ln,
            });
            break;
        }
      }
    }

    return {
      added,
      file: file.to ?? file.from ?? "unknown",
      removed,
    };
  });
}
