export const CASE_STATUSES = [
  "received",
  "needs_info",
  "verified",
  "filed",
  "acknowledged",
  "inspection_ordered",
  "ic_formed",
  "closed_not_filed",
  "closed",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export function isCaseStatus(v: unknown): v is CaseStatus {
  return typeof v === "string" && (CASE_STATUSES as readonly string[]).includes(v);
}
