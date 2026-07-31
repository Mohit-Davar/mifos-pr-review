import {
  type Change,
  type DiffLine,
  isIgnoredFile,
  matchesScanPatterns,
  type ParsedFileDiff,
} from "@src/shared";
import parseDiff from "parse-diff";

/**
 * Parses a raw git diff string and filters out files that should not be scanned.
 * @param diff - The raw git diff string to parse.
 * @returns An array of parsed file diffs containing only files that should be scanned.
 * @remarks
 * This function processes lines inside chunks to separate added, deleted, and unmodified context changes.
 * To normalise the output data, the leading Git prefix metadata characters (`+`, `-`, or space) are sliced off from the starting index of the string content.
 */
export function parseGitDiff(diff: string): ParsedFileDiff[] {
  const parsedFiles = parseDiff(diff);

  return parsedFiles
    .map((file) => {
      const fileName = file.to ?? file.from ?? "unknown";
      if (!matchesScanPatterns(fileName)) {
        return null;
      }
      if (isIgnoredFile(fileName)) {
        return null;
      }

      // Process changes only for files that passed the filters
      const added: Change[] = [];
      const removed: Change[] = [];
      const context: Change[] = [];
      const changesList: DiffLine[] = [];

      for (const chunk of file.chunks) {
        for (const change of chunk.changes) {
          const content = change.content.slice(1);
          switch (change.type) {
            case "add":
              added.push({ content, lineNumber: change.ln });
              changesList.push({ content, lineNumber: change.ln, prefix: "+" });
              break;
            case "del":
              removed.push({ content, lineNumber: change.ln });
              changesList.push({ content, lineNumber: change.ln, prefix: "-" });
              break;
            case "normal":
              context.push({ content, lineNumber: change.ln2 });
              changesList.push({
                content,
                lineNumber: change.ln2,
                prefix: " ",
              });
              break;
          }
        }
      }

      return {
        added,
        changes: changesList,
        context,
        file: fileName,
        removed,
      };
    })
    .filter((file): file is ParsedFileDiff => file !== null); // Filter out null values from ignored/skipped files
}
