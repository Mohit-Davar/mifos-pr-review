export type Severity = "high" | "medium" | "low";

export type Review = {
  file: string;
  line: number;
  severity: Severity;
  comment: string;
};

export type Reviews = {
  reviews: Review[];
};
