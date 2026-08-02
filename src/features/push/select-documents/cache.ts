import * as fs from "node:fs";
import * as path from "node:path";

import * as core from "@actions/core";
import type { CacheData } from "@src/features/push/select-documents/types";

const CACHE_DIR = ".mifoshawk";
const CACHE_FILE = "directory-cache.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns the absolute path to the directory cache file.
 *
 * The cache is stored under `.mifoshawk/directory-cache.json` within the
 * GitHub Actions workspace so it can be persisted using `actions/cache`.
 */
function getCacheFilePath(): string {
  const workspace =
    core.getInput("github-workspace") ||
    process.env["GITHUB_WORKSPACE"] ||
    process.cwd();

  return path.join(workspace, CACHE_DIR, CACHE_FILE);
}

/**
 * Loads the directory listing cache from disk.
 *
 * Returns an empty cache if the cache file does not exist or cannot be read.
 *
 * @returns The cached directory listings.
 */
export function loadDirectoryCache(): CacheData {
  const filePath = getCacheFilePath();
  if (!fs.existsSync(filePath)) {
    return { listings: {} };
  }
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as CacheData;
  } catch (error) {
    core.debug(`Failed to read directory cache: ${error}`);
    return { listings: {} };
  }
}

/**
 * Persists the directory listing cache to disk.
 *
 * Creates the cache directory if it does not already exist. Failures are
 * logged as warnings but are otherwise non-fatal.
 *
 * @param data - Cache contents to persist.
 */
export function saveDirectoryCache(data: CacheData): void {
  const filePath = getCacheFilePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    core.warning(`Failed to write directory cache: ${error}`);
  }
}

/**
 * Retrieves a cached directory or page listing.
 *
 * Cached entries are considered valid for 24 hours. Expired or missing
 * entries return `null`.
 *
 * @param repo - Repository or cache namespace.
 * @param branch - Branch associated with the cached entry.
 * @param dirPath - Directory path or cache identifier.
 * @returns The cached listing, or `null` if no valid entry exists.
 */
export function getCachedDirectoryListing(
  repo: string,
  branch: string,
  dirPath: string
): string[] | null {
  const cache = loadDirectoryCache();
  const cacheKey = `${repo}:${branch}:${dirPath}`;
  const entry = cache.listings[cacheKey];
  if (!entry || Date.now() - entry.timestamp > CACHE_TTL_MS) {
    return null;
  }
  return entry.files;
}

/**
 * Stores a directory or page listing in the cache.
 *
 * Existing entries for the same repository, branch and path are replaced.
 *
 * @param repo - Repository or cache namespace.
 * @param branch - Branch associated with the cached entry.
 * @param dirPath - Directory path or cache identifier.
 * @param files - File or page listing to cache.
 */
export function setCachedDirectoryListing(
  repo: string,
  branch: string,
  dirPath: string,
  files: string[]
): void {
  const cache = loadDirectoryCache();
  const cacheKey = `${repo}:${branch}:${dirPath}`;
  cache.listings[cacheKey] = {
    files,
    timestamp: Date.now(),
  };
  saveDirectoryCache(cache);
}
