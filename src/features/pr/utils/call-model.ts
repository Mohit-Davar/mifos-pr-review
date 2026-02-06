import { openai, model } from "@src/shared/lib/model";
import type { ParsedFileDiff } from "./diff-parser";

export async function callAI(diffs: ParsedFileDiff[]) {
    const formattedDiff = diffs
        .map((f) => {
            return `### File: ${f.file}\n` +
                `**Added:**\n${f.added.map(l => `+ ${l}`).join("\n")}\n` +
                `**Removed:**\n${f.removed.map(l => `- ${l}`).join("\n")}`;
        })
        .join("\n\n");

    const response = await openai.chat.completions.create({
        model: model,
        messages: [
            {
                role: "system",
                content: `You are a senior software engineer reviewing a pull request.
                        Analyse the provided file changes. 
                        Provide a clear, concise review summary and identify potential bugs, security issues, or performance improvements.
                        Be specific about which file you are referring to.`,
            },
            {
                role: "user",
                content: `Here are the structured changes for this PR:\n\n${formattedDiff}`,
            },
        ],
    });

    return response.choices[0]?.message?.content || "No review summary generated.";
}

