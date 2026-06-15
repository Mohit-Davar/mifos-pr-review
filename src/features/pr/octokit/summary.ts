import type { Review } from "@src/features/pr/llm-call";
import type { Severity } from "@src/features/pr/security-engine";

const SEV_COLOR: Record<Severity, string> = {
  high: "B60205",
  low: "0075CA",
  medium: "E4A11B",
};

const SEV_LABEL: Record<Severity, string> = {
  high: "High",
  low: "Low",
  medium: "Medium",
};

function severityBadge(sev: Severity): string {
  return `![${SEV_LABEL[sev]}](https://img.shields.io/badge/severity-${SEV_LABEL[sev].toLowerCase()}-${SEV_COLOR[sev]}?style=flat-square&labelColor=1a1a1a)`;
}

const STATUS_CLEAN =
  "![Clean](https://img.shields.io/badge/security-clean-2EA44F?style=flat-square&labelColor=1a1a1a)";

const STATUS_ISSUES =
  "![Issues Found](https://img.shields.io/badge/security-issues_found-B60205?style=flat-square&labelColor=1a1a1a)";

const severityWeight: Record<Severity, number> = {
  high: 3,
  low: 1,
  medium: 2,
};

export function generateSummary(reviews: Review[]): string {
  const total = reviews.length;

  const counts: Record<Severity, number> = { high: 0, low: 0, medium: 0 };
  for (const r of reviews) counts[r.severity]++;

  const hr = "---";

  if (total === 0) {
    return [
      "## Security Review",
      "",
      STATUS_CLEAN,
      "",
      hr,
      "",
      "> No security issues were detected in the analyzed changes.",
      "",
    ].join("\n");
  }

  const severities: Severity[] = ["high", "medium", "low"];

  const summaryRows = severities
    .filter((s) => counts[s] > 0)
    .map((s) => `| ${severityBadge(s)} | **${counts[s]}** |`);

  const sortedReviews = [...reviews].sort(
    (a, b) => severityWeight[b.severity] - severityWeight[a.severity]
  );

  const findingRows = sortedReviews.map((r) => {
    const file = `\`${r.file.replace(/\|/g, "\\|")}\``;
    const issue = r.problem.replace(/\n/g, " ").replace(/\|/g, "\\|").trim();
    return `| ${severityBadge(r.severity)} | ${file} | \`${r.line}\` | ${issue} |`;
  });

  return [
    "## Security Review",
    "",
    STATUS_ISSUES,
    "",
    hr,
    "",
    `> **${total} finding${total === 1 ? "" : "s"}** identified. ` +
      "Resolve all high-severity issues before merging.",
    "",
    "### Summary",
    "",
    "| Severity | Count |",
    "| :--- | ---: |",
    ...summaryRows,
    "",
    "### Findings",
    "",
    "| Severity | File | Line | Issue |",
    "| :--- | :--- | :---: | :--- |",
    ...findingRows,
    "",
  ].join("\n");
}
