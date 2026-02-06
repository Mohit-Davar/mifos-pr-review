import parseDiff from "parse-diff";

export type Change = {
    content: string;
    lineNumber: number;
};

export type ParsedFileDiff = {
    file: string;
    added: Change[];
    removed: Change[];
};

export function parseGitDiff(diff: string): ParsedFileDiff[] {
    const files = parseDiff(diff);

    return files.map((file) => {
        const added: Change[] = [];
        const removed: Change[] = [];

        for (const chunk of file.chunks) {
            for (const change of chunk.changes) {
                if (change.type === "add") {
                    added.push({ content: change.content.slice(1), lineNumber: change.ln });
                }

                if (change.type === "del") {
                    removed.push({ content: change.content.slice(1), lineNumber: change.ln });
                }
            }
        }

        return {
            file: file.to ?? file.from ?? "unknown",
            added,
            removed,
        };
    });
}

const IGNORED_FILES_REGEX = /(\.lock|package-lock\.json|pnpm-lock\.yaml|go\.sum)$/;
export function filterDiffForReview(diff: ParsedFileDiff[]): ParsedFileDiff[] {
    return diff.filter((file) => !IGNORED_FILES_REGEX.test(file.file));
}
