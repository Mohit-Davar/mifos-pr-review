import type { ParsedFileDiff } from "@src/features/pr/git-diff";
import { SYSTEM_PROMPT } from "@src/features/pr/llm-call/prompts";
import type { Reviews } from "@src/features/pr/llm-call/types";
import { getConfig } from "@src/shared/config";
import { expectError } from "@src/shared/expect-error";
import { createLLMClient } from "@src/shared/model";

export async function callLLM(
  diffs: ParsedFileDiff[],
  securityFindings: Reviews,
  cveFindings: Reviews,
  apiKey: string
): Promise<Reviews> {
  const openai = createLLMClient(apiKey);
  const config = getConfig();
  const modelToUse = config.model || "gpt-5-nano";

  const diffText = diffs
    .map((file) => {
      const added = file.added.map((l) => `+${l.content}`).join("\n");
      const removed = file.removed.map((l) => `-${l.content}`).join("\n");

      return `FILE ${file.file}\n${added}${added && removed ? "\n" : ""}${removed}`;
    })
    .join("\n\n");

  const findingsText = securityFindings.reviews.length
    ? `SECURITY_FINDINGS_FROM_REGEX:\n${JSON.stringify(
        securityFindings.reviews
      )}`
    : `SECURITY_FINDINGS_FROM_REGEX:\nNONE`;

  const cveText = cveFindings.reviews.length
    ? `CVE_FINDINGS:\n${JSON.stringify(cveFindings.reviews)}`
    : `CVE_FINDINGS:\nNONE`;

  const [error, response] = await expectError(
    openai.chat.completions.create({
      messages: [
        { content: SYSTEM_PROMPT, role: "system" },
        {
          content: `DIFF\n${diffText}\n\n${findingsText}\n\n${cveText}`,
          role: "user",
        },
      ],
      model: modelToUse,
      response_format: { type: "json_object" },
    })
  );

  if (error || !response) {
    console.error("LLM API call failed:", error);
    return { reviews: [] };
  }

  try {
    return JSON.parse(response.choices[0]?.message?.content ?? "{}") as Reviews;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return { reviews: [] };
  }
}
