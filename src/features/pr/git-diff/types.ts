export type Change = {
  content: string;
  lineNumber: number;
};

export type ParsedFileDiff = {
  added: Change[];
  context: Change[];
  file: string;
  removed: Change[];
};
