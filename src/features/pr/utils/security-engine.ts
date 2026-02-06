import type { ParsedFileDiff } from "@src/features/pr/utils/git-diff";

export interface SecurityRule {
    id: string;
    description: string;
    pattern: RegExp;
    severity: "high" | "medium" | "low";
    fileExtensions?: string[];
}

export interface SecurityFinding {
    file: string;
    line: number;
    ruleId: string;
    description: string;
    severity: "high" | "medium" | "low";
    content: string;
}

const SOURCE_CODE_EXTENSIONS = [".js", ".ts", ".py", ".go", ".java", ".php", ".cs", ".rb", ".sh"];

const rules: SecurityRule[] = [
    {
        id: "private-key",
        description: "Private key detected. Private keys should not be committed to version control.",
        pattern: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/,
        severity: "high",
    },
    {
        id: "aws-access-key-id",
        description: "AWS Access Key ID detected. Credentials should be managed via a secret management system.",
        pattern: /(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])/,
        severity: "high",
    },
    {
        id: "aws-secret-access-key",
        description: "AWS Secret Access Key detected. Credentials should be managed via a secret management system.",
        pattern: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/,
        severity: "high",
    },
    {
        id: "hardcoded-secret",
        description: "Potential hardcoded secret or credential found.",
        pattern: /(secret|password|token|apikey|api_key|auth_token|access_token|secret_key)\s*[:=]\s*['"`]([^'"`\n]{8,})['"`]/i,
        severity: "medium",
    },
    {
        id: "generic-api-key",
        description: "A generic API key has been detected which may be a secret.",
        pattern: /[A-Za-z0-9_,\-]{20,}[_]?[A-Za-z0-9_,\-]{10,}/,
        severity: "low",
    },
    {
        id: "eval-usage",
        description: "Use of `eval()` is discouraged as it can lead to security vulnerabilities.",
        pattern: /eval\(/,
        severity: "medium",
        fileExtensions: SOURCE_CODE_EXTENSIONS,
    },
    {
        id: "dangerous-exec",
        description: "Use of shell/command execution functions is dangerous and can lead to command injection.",
        pattern: /\b(exec|os\.system|subprocess\.run|shell_exec)\s*\(/i,
        severity: "medium",
        fileExtensions: SOURCE_CODE_EXTENSIONS,
    }
];

export function runSecurityEngine(diffs: ParsedFileDiff[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const fileDiff of diffs) {
        for (const addedLine of fileDiff.added) {
            for (const rule of rules) {
                // If the rule has file extension restrictions, check if the file matches.
                if (rule.fileExtensions && !rule.fileExtensions.some(ext => fileDiff.file.endsWith(ext))) {
                    continue; // Skip rule if the file extension doesn't match.
                }

                if (rule.pattern.test(addedLine.content)) {
                    findings.push({
                        file: fileDiff.file,
                        line: addedLine.lineNumber,
                        ruleId: rule.id,
                        description: rule.description,
                        severity: rule.severity,
                        content: addedLine.content,
                    });
                }
            }
        }
    }

    return findings;
}

