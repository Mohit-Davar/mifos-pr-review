import * as fs from "node:fs";
import * as path from "node:path";

import * as core from "@actions/core";
import { type Config, ConfigSchema } from "@src/shared/config";
import yaml from "yaml";

/** Cached configuration to avoid reloading. */
let cachedConfig: Config | undefined;

/**
 * Loads the configuration from `.mifoshawk.yml` within the given workspace directory.
 * Returns a `Config` object parsed with `ConfigSchema`. The result is cached for future calls.
 */
export function loadConfig(workspacePath: string | undefined): Config {
  if (!workspacePath) {
    core.warning("No workspace path provided. Using default configuration.");
    cachedConfig = {};
    return cachedConfig;
  }
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(workspacePath, ".mifoshawk.yml");
  if (!fs.existsSync(configPath)) {
    core.info("No .mifoshawk.yml found. Using default configuration.");
    cachedConfig = {};
    return cachedConfig;
  }

  try {
    const fileContent = fs.readFileSync(configPath, "utf8");
    const parsedYaml = yaml.parse(fileContent);
    cachedConfig = ConfigSchema.parse(parsedYaml);
    core.info(`Loaded configuration from ${configPath}`);
    return cachedConfig;
  } catch (error) {
    throw new Error(`Invalid configuration in ${configPath}`, {
      cause: error,
    });
  }
}

/**
 * Returns the cached configuration, loading it on first access.
 * If the configuration has not been loaded yet, it loads it from the workspace
 * using `loadConfig` and caches the result.
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }
  const workspacePath =
    core.getInput("github-workspace") || process.env["GITHUB_WORKSPACE"];
  return loadConfig(workspacePath);
}
