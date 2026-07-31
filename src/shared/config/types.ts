import type { SecurityRule } from "@src/features/pr/security-engine";

/** Documentation audiences that can be targeted for updates. */
export type DocAudience = "user" | "implementor" | "developer";

/** Shared fields for all documentation platforms. */
export interface BaseDocument {
  /** The target audience for the documentation. */
  audience: DocAudience;
  /** Whether the document is enabled for updates. */
  enabled?: boolean;
  /** The purpose of the document. */
  purpose: string;
}

/** Shared interface for platforms using centralized GitHub documentation. */
export interface GitHubSyncDocument extends BaseDocument {
  /** The branch to sync from. */
  branch?: string;
  /** The path to the document in the repository. */
  path: string;
  /** The repository to sync from. */
  repo?: string;
}

/** GitBook page configuration. */
export interface GitBookDocument extends GitHubSyncDocument {
  /** The documentation platform. */
  platform: "gitbook";
}

/** ReadMe page configuration. */
export interface ReadMeDocument extends GitHubSyncDocument {
  /** The documentation platform. */
  platform: "readme";
}

/** Confluence page configuration. */
export interface ConfluenceDocument extends BaseDocument {
  /** The ID of the Confluence page. */
  pageId: string;
  /** The documentation platform. */
  platform: "confluence";
}

/** Supported documentation targets. */
export type DocumentConfig =
  GitBookDocument | ReadMeDocument | ConfluenceDocument;

/** Files included or excluded from review. */
export interface ReviewFilesConfig {
  /** A list of glob patterns to exclude from reviews. */
  exclude?: string[];
  /** A list of glob patterns to include in reviews. */
  include?: string[];
}

/** Security review configuration. */
export interface ReviewSecurityConfig {
  /** Dependency lock files monitored for CVE scanning. */
  dependencyFiles?: string[];
  /** Custom security detection rules. */
  rules?: SecurityRule[];
}

/** Pull request review configuration. */
export interface ReviewConfig {
  /** Configuration for files to include or exclude from review. */
  files?: ReviewFilesConfig;
  /** LLM model used for review generation. */
  model?: string;
  /** Configuration for security reviews. */
  security?: ReviewSecurityConfig;
}

/** Documentation update configuration. */
export interface DocumentationConfig {
  /** A list of document configurations. */
  documents: DocumentConfig[];
  /** Whether documentation updates are enabled. */
  enabled?: boolean;
}

/** Root RepoPilot configuration. */
export interface Config {
  /** Configuration for documentation updates. */
  documentation?: DocumentationConfig;
  /** Configuration for pull request reviews. */
  review?: ReviewConfig;
}

/** Credentials supplied through GitHub Action inputs. */
export interface PlatformCredentials {
  /** Confluence API credentials. */
  confluence?: {
    /** The Confluence API token. */
    apiToken: string;
    /** The base URL of the Confluence instance. */
    baseUrl: string;
    /** The username for Confluence authentication. */
    username: string;
  };
  /** GitHub token for accessing documentation repositories. */
  docsGithubToken?: string;
}
