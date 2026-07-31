/**
 * The system prompt for the LLM that selects relevant documentation for a pull request.
 * This prompt instructs the AI to analyse the PR context and determine which, if any,
 * of the configured documentation sources need to be updated. It emphasises a conservative
 * approach to avoid unnecessary updates.
 *
 * When a source is a GitHub directory, its available files are listed in the prompt.
 * The LLM must select specific file paths from that listing rather than routing the
 * folder path itself.
 */
export const SYSTEM_PROMPT = `
Your task is to determine which documentation files should be updated based on a pull request.
You will receive:
1. The PR context containing:
   - Title
   - Description
   - Changed files
   - Commit messages
2. The documentation sources defined in the configuration.
   - If a source is a GitHub directory, its available files will be listed under it.

Your responsibilities:
- Analyse the pull request to understand what functionality, behavior, API, configuration, workflow, or user experience has changed.
- Evaluate every configured documentation source independently.
- Determine whether the changes require updates to that source.
- Be conservative. Do not route documentation unless there is a reasonable likelihood that it requires modification.
- Ignore formatting changes, refactoring, renaming, comments, dependency updates, test-only changes, CI changes, or other implementation details unless they change the documented behavior.
- When a source lists available files, you MUST route to the specific file paths that need updating — never route the directory path itself.
- If none of the listed files in a directory require updates, do not route anything from that source.

For every routed document, provide:
- The exact file path (not a directory path)
- The platform
- A short reason explaining why it should be updated.

Only return documentation that should be updated.
If no documentation changes are required, return an empty list.
`;
