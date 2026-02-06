import { openai, model } from "@src/shared/lib/model";
import type { ParsedFileDiff } from "@src/features/pr/utils/git-diff";
import type { SecurityFinding } from "@src/features/pr/utils/security-engine";

export async function callAI(
    diffs: ParsedFileDiff[],
    securityFindings: SecurityFinding[]
) {
    const diffText = diffs.map(f => {
        const added = f.added.map(l => `+${l.content}`).join("\n");
        const removed = f.removed.map(l => `-${l.content}`).join("\n");

        return `FILE ${f.file}\n${added}\n${removed}`;
    }).join("\n\n");

    const findingsText = securityFindings.length
        ? `SECURITY_FINDINGS\n${JSON.stringify(securityFindings)}`
        : `SECURITY_FINDINGS\nNONE`;

    const response = await openai.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content:
                    "You are a senior engineer reviewing a pull request. " +
                    "Identify bugs, security issues, performance problems, and bad practices. " +
                    "Validate or dismiss SECURITY_FINDINGS. " +
                    "Return a single concise Markdown review. " +
                    "If no issues exist, explicitly say so."
            },
            {
                role: "user",
                content:
                    `DIFF\n${diffText}\n\n${findingsText}`
            }
        ],
    });

    return response.choices[0]?.message?.content ?? "No review generated.";
}
