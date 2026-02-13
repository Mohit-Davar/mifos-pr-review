export type Change = {
  content: string;
  lineNumber: number;
};

export type ParsedFileDiff = {
  file: string;
  added: Change[];
  removed: Change[];
};
