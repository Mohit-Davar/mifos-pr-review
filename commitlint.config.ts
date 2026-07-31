import pc from "picocolors";

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        // Renamed to avoid name collision with the built-in 'scope-empty' rule
        "jira-key-required": (parsed: { scope: string | null | undefined }) => {
          const jiraRegex = /^[A-Z]+-[0-9]+$/;

          if (!parsed.scope || !jiraRegex.test(parsed.scope)) {
            return [
              false,
              pc.red(`Invalid Commit Scope!`) +
                pc.yellow(
                  `\n>> The scope must be a valid, uppercase Jira Issue Key.`
                ) +
                pc.green(
                  `\n>> Correct Example: feat(MIFOS-123): add caching layer`
                ) +
                pc.magenta(`\n>> Received scope   : "${parsed.scope || ""}"`),
            ];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    // Enforce the custom Jira key rule as a blocking error (2)
    "jira-key-required": [2, "always"],
    // Fallback checks to ensure general format alignment
    "scope-case": [2, "always", "upper-case"],
    "scope-empty": [2, "never"],
  },
};
