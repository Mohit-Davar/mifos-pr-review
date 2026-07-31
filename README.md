# Mifos Hawk

A GitHub Action that reviews pull requests for security issues and keeps documentation in sync with merged code changes. Configuration lives in a single `.mifoshawk.yml` file.

## Table of Contents

- [Mifos Hawk](#mifos-hawk)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
    - [Security Reviews](#security-reviews)
    - [Documentation Updates](#documentation-updates)
  - [How It Works](#how-it-works)
    - [Pull Request Review Workflow](#pull-request-review-workflow)
    - [Documentation Update Workflow](#documentation-update-workflow)
  - [Setup \& Usage](#setup--usage)
    - [1. GitHub Actions Setup](#1-github-actions-setup)
    - [2. Inputs \& Secrets](#2-inputs--secrets)
  - [Configuration](#configuration-mifoshawkyml)
    - [Documentation Config](#documentation-config)
    - [Security Review Config](#security-review-config)
  - [Local Development \& Contribution](#local-development--contribution)
    - [Prerequisites](#prerequisites)
    - [Available Scripts](#available-scripts)
    - [Build for Release](#build-for-release)

---

## Features

### Security Reviews

Runs a three-stage analysis on every pull request:

1. **Dependency scanning** — checks changed dependencies against the [OSV database](https://osv.dev/) for known vulnerabilities.
2. **Static regex scan** — flags exposed secrets, keys, and unsafe function usage using configurable rules.
3. **LLM review** — reviews the full diff for logic-level vulnerabilities and validates findings from the first two stages.

Findings are tracked across commits, so fixed issues are marked resolved and only new issues are surfaced. Comments are posted inline on the relevant lines, and generated assets, lockfiles, and binaries are skipped to keep the noise down.

### Documentation Updates

On merge to `main`, an LLM reviews the PR diff against your configured documentation sources and determines which pages are affected. Supported targets:

- **GitHub-based (GitBook, Readme.io)** — opens a pull request in your docs repo with the proposed changes.
- **Confluence** — posts the proposed update as a comment on the original PR for manual review.

A second LLM call drafts the specific edits once a document is selected. Every edit is checked for formatting and reasonableness before it's published, so a broken or nonsensical change never goes out on its own.

---

## How It Works

![Architecture Diagram](images/architecture.png)

### Pull Request Review Workflow

1. **Trigger & fetch** — runs on `pull_request` events and pulls the raw diff from the GitHub API.
2. **Parse & filter** — structures the diff and drops non-code files (images, lockfiles).
3. **Dependency scan** — extracts changed dependencies from files like `package.json` or `requirements.txt` and checks them against OSV.dev.
4. **Static analysis** — applies configurable regex rules to catch secrets, API keys, and patterns like `eval()`.
5. **LLM review** — sends the diff, dependency findings, and static analysis results to an LLM for deeper review.
6. **State matching** — compares current findings against the previous commit's state (stored in the summary comment) to classify issues as `new`, `active`, or `fixed`.
7. **Comment** — posts a summary to the PR and adds inline comments for new issues; resolved issues are marked accordingly.

### Documentation Update Workflow

1. **Trigger** — runs on push to `main`, which indicates a merged PR.
2. **Collect context** — gathers the merged PR's diff, commit messages, and metadata.
3. **Select documents** — an LLM checks the PR context against the sources configured in `.mifoshawk.yml` and picks which files or pages need updates.
4. **Retrieve content** — fetches the current content of each selected document from its platform.
5. **Generate edits** — a second LLM call compares the PR changes against the document content and produces a precise set of edits.
6. **Validate & publish** — edits are checked for safety and correctness, then published as a PR (GitHub-based docs) or a comment (Confluence).

---

## Setup & Usage

### 1. GitHub Actions Setup

Create `.github/workflows/mifoshawk.yml`:

```yaml
name: Mifos Hawk

on:
  # Required for automated documentation updates
  push:
    branches:
      - main
  # Required for security reviews
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  mifos-hawk:
    name: Run Mifos Hawk
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # For inline code comments
      issues: write # For the main PR summary comment

    steps:
      - name: Run Mifos Hawk
        uses: openMF/community-ai-dev-tools@v1
        with:
          # Required for all operations
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}

          # Required for documentation updates
          docs-github-token: ${{ secrets.DOCS_GITHUB_TOKEN }}
          confluence-base-url: ${{ secrets.CONFLUENCE_BASE_URL }}
          confluence-username: ${{ secrets.CONFLUENCE_USERNAME }}
          confluence-api-token: ${{ secrets.CONFLUENCE_API_TOKEN }}
```

### 2. Inputs & Secrets

| Input                  | Description                                                               | Required                            |
| :--------------------- | :------------------------------------------------------------------------ | :---------------------------------- |
| `github-token`         | GitHub token for PR comments.                                             | **Yes**                             |
| `openai-api-key`       | API key for LLM-based analysis.                                           | **Yes**                             |
| `docs-github-token`    | PAT to push updates to a remote docs repo.                                | No (required for GitBook/Readme.io) |
| `confluence-base-url`  | Base URL of your Confluence instance (e.g., `https://org.atlassian.net`). | No (required for Confluence)        |
| `confluence-username`  | Username (email) for Confluence authentication.                           | No (required for Confluence)        |
| `confluence-api-token` | API token for Confluence authentication.                                  | No (required for Confluence)        |

---

## Configuration (`.mifoshawk.yml`)

Create a `.mifoshawk.yml` file in your repository root.

```yaml
# DOCUMENTATION UPDATES CONFIGURATION
documentation:
  enabled: true
  documents:
    #  GitBook docs synced via a central GitHub repo
    - platform: gitbook
      # The path is in the format /owner/repo/path/to/file_or_dir
      path: "/openMF/community-ai-dev-tools/gitbook/feature-a"
      audience: developer
      purpose: "Technical API references for Feature A."
    #  Confluence page
    - platform: confluence
      # The path is the Confluence Page ID
      path: "123456789"
      audience: user
      purpose: "End-user guides for our main product."

# PR SECURITY REVIEW CONFIGURATION
review:
  # Specify the LLM model to use
  model: "gpt-4-turbo"
  # Specify which files to include or exclude
  files:
    include:
      - "src/**"
    exclude:
      - "**/__tests__/**"
      - "docs/**"
  # Add custom security rules
  security:
    rules:
      - id: "slack-webhook"
        description: "Slack webhook URL detected. Avoid committing tokens."
        pattern: "https://hooks\.slack\.com/services/T[A-Z0-9_]+/B[A-Z0-9_]+/[A-Za-z0-9_]+"
        severity: "high"
        fileExtensions: [".ts", ".js", ".py"]
```

### Documentation Config

- `documentation.enabled` (boolean) — master switch for the documentation update feature.
- `documentation.documents` (array) — list of documentation sources.
  - `platform` (`gitbook` | `readme` | `confluence`) — the documentation platform.
  - `path` (string) — path to the document.
    - For `gitbook`/`readme`: `/owner/repo/path/to/file_or_dir`.
    - For `confluence`: the **Page ID**.
  - `audience` (`user` | `developer` | `implementor`) — target audience for the document.
  - `purpose` (string) — short description of the document's contents, used to help the LLM decide relevance.

### Security Review Config

- `review.model` (string) — LLM model used for analysis (e.g., `gpt-4-turbo`, `gpt-5-mini`).
- `review.files.include` (array) — glob patterns for files to include in the review. All files are considered if empty.
- `review.files.exclude` (array) — glob patterns for files to exclude from the review.
- `review.security.rules` (array) — custom regex-based security rules.
  - `id` — unique identifier.
  - `description` — message posted in the PR comment.
  - `pattern` — a RegExp string.
  - `severity` (`high` | `medium` | `low`).
  - `fileExtensions` (optional, array) — restricts the rule to specific file extensions.

---

## Local Development & Contribution

Contributions are welcome. Follow the steps below to set up a local environment.

### Prerequisites

This project uses [Bun](https://bun.sh/).

1. **Install Bun:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/OpenMF/community-ai-dev-tools.git
   cd community-ai-dev-tools
   bun install
   ```

### Available Scripts

| Command         | Description              |
| :-------------- | :----------------------- |
| `bun run dev`   | Run in development mode. |
| `bun run start` | Run once.                |
| `bun run lint`  | Lint code.               |
| `bun run fix`   | Format and fix.          |

### Build for Release

```bash
bun run build
```

This compiles `src/index.ts` to `dist/index.js`, the entry point used by the GitHub Action.
