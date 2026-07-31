/** Represents a single line change in a diff. */
export type Change = {
  /** The content of the line. */
  content: string;
  /** The line number of the change. */
  lineNumber: number;
};

/** Represents a line in a diff, including its prefix (+, -, or space). */
export type DiffLine = {
  /** The content of the line. */
  content: string;
  /** The line number in the file. */
  lineNumber: number;
  /** The prefix of the diff line (+, -, or space for context). */
  prefix: string;
};

/** Represents the parsed diff for a single file. */
export type ParsedFileDiff = {
  /** Lines that were added. */
  added: Change[];
  /** All lines in the diff chunk. */
  changes: DiffLine[];
  /** Context lines (unchanged). */
  context: Change[];
  /** The name of the file. */
  file: string;
  /** Lines that were removed. */
  removed: Change[];
};

/**
 * Represents a chunk of diffs, used for splitting large diffs into smaller parts.
 * @template T The type of items in the diffs array, defaults to ParsedFileDiff.
 */
export interface DiffChunk<T = ParsedFileDiff> {
  /** The index of the current chunk. */
  chunkIndex: number;
  /** The array of diff items in the chunk. */
  diffs: T[];
  /** The total number of chunks. */
  totalChunks: number;
}
