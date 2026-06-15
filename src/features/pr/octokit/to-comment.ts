import type { Review } from "@src/features/pr/llm-call";
import type { Severity } from "@src/features/pr/security-engine";

const SEV_LABEL: Record<Severity, string> = {
  high: "High severity",
  low: "Low severity",
  medium: "Medium severity",
};

const SEV_COLOR: Record<Severity, string> = {
  high: "B60205",
  low: "0075CA",
  medium: "E4A11B",
};

function severityBadge(sev: Severity): string {
  const label = SEV_LABEL[sev];
  return `![${label}](https://img.shields.io/badge/${encodeURIComponent(label).replace(/%20/g, "_")}-${SEV_COLOR[sev]}?style=flat-square&labelColor=1a1a1a)`;
}

export const toComment = (r: Review) => {
  const parts: string[] = [
    `${severityBadge(r.severity)}  \`${r.file}:${r.line}\``,
    "",
    "---",
    "",
    "**Problem**",
    "",
    r.problem,
  ];

  if (r.solution) {
    parts.push("", "**Solution**", "", r.solution);
  }

  if (r.prompt) {
    parts.push("", "**AI prompt**", "", "```text", r.prompt, "```");
  }

  return {
    body: parts.join("\n"),
    line: r.line,
    path: r.file,
  };
};
