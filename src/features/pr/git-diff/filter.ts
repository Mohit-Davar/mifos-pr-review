import type { ParsedFileDiff } from "@src/features/pr/git-diff/types";

const IGNORED_EXTENSIONS = [
  ".lock",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".mp4",
  ".mp3",
  ".pdf",
  ".min.js",
  ".min.css",
  ".map",
  ".ico",
];

const IGNORED_FILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "bun.lockb",
  "go.sum",
  ".DS_Store",
];

export function filterDiff(diff: ParsedFileDiff[]): ParsedFileDiff[] {
  return diff.filter((file) => {
    return (
      !IGNORED_FILES.includes(file.file) &&
      !IGNORED_EXTENSIONS.some((ext) => file.file.endsWith(ext))
    );
  });
}
