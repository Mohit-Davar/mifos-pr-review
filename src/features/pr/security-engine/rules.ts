import type { SecurityRule } from "@src/features/pr/security-engine/types";

const SOURCE_CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".py",
  ".go",
  ".java",
  ".php",
  ".cs",
  ".rb",
  ".sh",
];

export const rules: SecurityRule[] = [
  {
    id: "private-key",
    description:
      "Private key detected. Private keys should not be committed to version control.",
    pattern: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
    severity: "high",
  },

  {
    id: "aws-access-key-id",
    description:
      "AWS Access Key ID detected. Credentials should be managed securely.",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "high",
  },

  {
    id: "aws-secret-access-key",
    description: "Potential AWS Secret Access Key detected.",
    pattern:
      /(aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"`][A-Za-z0-9/+=]{40}['"`]/,
    severity: "high",
  },

  {
    id: "hardcoded-secret",
    description: "Potential hardcoded secret or credential found.",
    pattern:
      /\b(secret|password|token|apikey|api_key|auth_token|access_token|secret_key)\b\s*[:=]\s*['"`]([^'"`\n]{8,})['"`]/i,
    severity: "medium",
    fileExtensions: SOURCE_CODE_EXTENSIONS,
  },

  {
    id: "generic-api-key",
    description:
      "Long high-entropy string detected that may represent an API key.",
    // Reduced noise: must be inside quotes
    pattern: /['"`][A-Za-z0-9\-_]{30,}['"`]/,
    severity: "low",
    fileExtensions: SOURCE_CODE_EXTENSIONS,
  },

  {
    id: "eval-usage",
    description:
      "Use of eval() is discouraged as it can lead to security vulnerabilities.",
    pattern: /\beval\s*\(/,
    severity: "medium",
    fileExtensions: SOURCE_CODE_EXTENSIONS,
  },

  {
    id: "dangerous-exec",
    description:
      "Use of command execution functions may lead to command injection.",
    pattern: /\b(exec|os\.system|subprocess\.run|shell_exec)\s*\(/i,
    severity: "medium",
    fileExtensions: SOURCE_CODE_EXTENSIONS,
  },
];
