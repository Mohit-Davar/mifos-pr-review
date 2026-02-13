import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import { SYSTEM_PROMPT } from "@src/features/pr/llm-call/prompts";
import type { Reviews } from "@src/features/pr/llm-call/types";
import { model, openai } from "@src/shared/lib/model";

export async function callLLM(
  diffs: ParsedFileDiff[],
  securityFindings: Reviews
): Promise<Reviews> {
  const diffText = diffs
    .map((file) => {
      const added = file.added.map((l) => `+${l.content}`).join("\n");
      const removed = file.removed.map((l) => `-${l.content}`).join("\n");

      return `FILE ${file.file}\n${added}${added && removed ? "\n" : ""}${removed}`;
    })
    .join("\n\n");

  const findingsText = securityFindings.reviews.length
    ? `SECURITY_FINDINGS_FROM_REGEX:\n${JSON.stringify(securityFindings.reviews)}`
    : `SECURITY_FINDINGS_FROM_REGEX:\nNONE`;

  const response = await openai.chat.completions.create({
    model: model || "gpt-5-nano",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `DIFF\n${diffText}\n\n${findingsText}` },
    ],
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(response.choices[0]?.message?.content ?? "{}") as Reviews;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return { reviews: [] };
  }
}
