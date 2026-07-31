import { getConfig } from "@src/shared";
import { minimatch } from "minimatch";

/**
 * A list of default file patterns to ignore during reviews.
 * This includes common binary files and lock files.
 */
export const DEFAULT_IGNORED_PATTERNS = [
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

/**
 * Checks if a file should be ignored based on the default patterns and user-defined configuration.
 *
 * @param fileName - The name of the file to check.
 * @returns `true` if the file should be ignored, `false` otherwise.
 */
export function isIgnoredFile(fileName: string): boolean {
  const config = getConfig();
  const ignoredPatterns = [
    ...DEFAULT_IGNORED_PATTERNS,
    ...(config.review?.files?.exclude || []),
  ];
  return ignoredPatterns.some((p) =>
    minimatch(fileName, p, { matchBase: true })
  );
}

/**
 * Checks if a file matches the scan patterns defined in the configuration.
 * If no scan patterns are defined, it returns true for any file not otherwise ignored.
 *
 * @param fileName - The name of the file to check.
 * @returns `true` if the file should be scanned, `false` otherwise.
 */
export function matchesScanPatterns(fileName: string): boolean {
  const config = getConfig();
  const scanPatterns = config.review?.files?.include || [];
  if (scanPatterns.length === 0) {
    return true; // If no specific patterns to scan, include everything not ignored
  }
  return scanPatterns.some((p) => minimatch(fileName, p));
}
