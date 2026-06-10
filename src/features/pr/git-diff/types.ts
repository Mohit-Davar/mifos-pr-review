export type Change = {
  content: string;
  lineNumber: number;
};

export type ParsedFileDiff = {
  added: Change[];
  file: string;
  removed: Change[];
};
