import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import { getConfig } from "@src/shared";
import { minimatch } from "minimatch";

const DEFAULT_IGNORED_PATTERNS = [
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.svg",
  "*.ico",
  "*.pdf",
  "*.mp3",
  "*.mp4",
  "*.map",
  "package-lock.json",
  "pnpm-lock.yaml",
  "bun.lockb",
  "go.sum",
  "Cargo.lock",
  "Gemfile.lock",
  "composer.lock",
];

export function filterDiff(files: ParsedFileDiff[]): ParsedFileDiff[] {
  const config = getConfig();
  // Combine default ignore patterns with user-defined ones cleanly
  const ignoredPatterns = [
    ...DEFAULT_IGNORED_PATTERNS,
    ...(config.ignore || []),
  ];
  const scanPatterns = config.filesToScan || [];

  return files.filter(({ file }) => {
    // If scan patterns exist, the file must match at least one to proceed
    if (scanPatterns.length > 0) {
      const matchesScan = scanPatterns.some((pattern) =>
        minimatch(file, pattern)
      );
      if (!matchesScan) {
        return false;
      }
    }

    // If the file matches any ignore patterns, filter it out
    const isIgnored = ignoredPatterns.some((pattern) =>
      minimatch(file, pattern, { matchBase: true })
    );

    return !isIgnored;
  });
}
