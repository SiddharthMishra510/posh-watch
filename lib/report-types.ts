// The plaintext inside every encrypted report. Only the browser that writes it
// and the operator's admin page ever see this shape.
export interface ReportPayload {
  v: 1;
  submittedOn: string; // YYYY-MM-DD
  lang: string;
  reporterPublicKey: string; // derived from the receipt code; lets the operator reply
  establishment: { name: string; tradeName: string; address: string; district: string; sector: string; employees: string };
  missing: string[];
  relation: string;
  details: string;
  filing: "platform" | "named";
  named: { name: string; contact: string } | null;
  declaration: true;
  attachments: { name: string; type: "image/jpeg"; data: string }[];
}

/** A message between the operator and the reporter, before encryption. */
export interface MessagePayload {
  text: string;
  on: string; // YYYY-MM-DD
}

export const today = () => new Date().toISOString().slice(0, 10);
