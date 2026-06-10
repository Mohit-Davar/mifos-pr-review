import type { Severity } from "@src/features/pr/security-engine";

export type Review = {
  comment: string;
  file: string;
  line: number;
  severity: Severity;
};

export type Reviews = {
  reviews: Review[];
};
