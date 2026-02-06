import parseDiff from "parse-diff";

export type ParsedFileDiff = {
    file: string;
    added: string[];
    removed: string[];
    context: string[];
};

export function parseGitDiff(diff: string): ParsedFileDiff[] {
    const files = parseDiff(diff);

    return files.map((file) => {
        const added: string[] = [];
        const removed: string[] = [];
        const context: string[] = [];

        for (const chunk of file.chunks) {
            for (const change of chunk.changes) {
                if (change.type === "add") {
                    added.push(change.content.slice(1));
                }

                if (change.type === "del") {
                    removed.push(change.content.slice(1));
                }

                if (change.type === "normal") {
                    context.push(change.content.slice(1));
                }
            }
        }

        return {
            file: file.to ?? file.from ?? "unknown",
            added,
            removed,
            context,
        };
    });
}
