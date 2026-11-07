// Letter templates, matching the toolkit doc. Get your lawyer's corrections into
// both places. Output is plain text so it can be pasted into email or printed.

import type { ReportPayload } from "./report-types";

export interface Operator {
  name: string;
  platform: string;
  address: string;
  email: string;
  phone: string;
}

export interface LetterInput {
  ref: string;
  date: string; // letter date, e.g. 7 November 2026
  district: string;
  report: ReportPayload;
  operator: Operator;
  employeesBasis: string; // e.g. "company website and LinkedIn headcount, checked 2 Feb 2027"
  sheboxDate: string; // blank when not checked
  firstLetterDate: string; // escalation and RTI
  tracking: string;
  replyStatus: string; // escalation: "no acknowledgement" or "an acknowledgement but no information on action taken"
}

const RANGE_EN: Record<string, string> = {
  "10-19": "10 to 19",
  "20-49": "20 to 49",
  "50-249": "50 to 249",
  "250+": "250 or more",
  unsure: "10 or more",
};
const RANGE_MR: Record<string, string> = {
  "10-19": "१० ते १९",
  "20-49": "२० ते ४९",
  "50-249": "५० ते २४९",
  "250+": "२५० किंवा अधिक",
  unsure: "१० किंवा अधिक",
};

const or = (v: string, placeholder: string) => (v && v.trim() ? v.trim() : placeholder);

function establishmentName(r: ReportPayload) {
  const e = r.establishment;
  return e.tradeName && e.tradeName !== e.name ? `${e.name} (trading as ${e.tradeName})` : e.name;
}

/** Which numbered facts the letter states, from what the reporter ticked. */
function facts(r: ReportPayload, sheboxDate: string) {
  const m = new Set(r.missing);
  return {
    noIc: m.has("no_ic") || m.has("ic_unknown"),
    noDisplay: m.has("no_policy") || m.has("no_display"),
    noTraining: m.has("no_training"),
    shebox: Boolean(sheboxDate),
  };
}

function letterhead(o: Operator) {
  return `${or(o.name, "[Your full name]")}\n${or(o.platform, "[Platform name]")} | ${or(o.address, "[postal address]")} | ${or(o.email, "[email]")} | ${or(o.phone, "[phone]")}`;
}

export function letterEnglish(i: LetterInput) {
  const r = i.report;
  const f = facts(r, i.sheboxDate);
  const e = r.establishment;
  const items: string[] = [];
  if (f.noIc) items.push("No Internal Committee has been constituted, or its constitution has\n       not been made known to employees.");
  if (f.noDisplay) items.push("No policy on sexual harassment, and no details of an Internal\n       Committee, are displayed at the workplace.");
  if (f.noTraining) items.push("No awareness or orientation sessions have been held.");
  if (f.shebox) items.push(`No Internal Committee for this establishment appears on the SHe-Box\n       portal (searched on ${i.sheboxDate}).`);
  const lettered = items.map((t, n) => `   (${"abcd"[n]}) ${t}`).join("\n");

  const informant =
    r.filing === "named" && r.named
      ? `   This information is submitted by ${r.named.name}, who works at the\n   establishment named below and has asked me to submit it on their\n   behalf. Their contact details are enclosed separately and are\n   provided in confidence.`
      : `   I have received information from a person working at the\n   establishment named below. That person has asked that their identity\n   be kept confidential, and I do not hold it.`;

  return `${letterhead(i.operator)}

Date: ${i.date}
Our reference: ${i.ref}

To,
The District Officer
(Sexual Harassment of Women at Workplace (Prevention, Prohibition and
Redressal) Act, 2013)
Office of the Collector, ${i.district}

Copy to:
The District Women and Child Development Officer, ${i.district}

Subject: Information regarding non-constitution of the Internal Committee
under Section 4 of the Sexual Harassment of Women at Workplace (Prevention,
Prohibition and Redressal) Act, 2013, at ${e.name}; request for inspection
under Section 25

Respected Sir/Madam,

1. I run ${or(i.operator.platform, "[platform name]")}, a public-interest service through which people
   working in Maharashtra can report workplaces that have not set up the
   mechanisms required by the POSH Act, 2013.

2.${informant.slice(2)}

3. Establishment
   Name: ${establishmentName(r)}
   Workplace address: ${e.address}, ${i.district}
   Approximate employees at this address: ${RANGE_EN[e.employees] ?? "10 or more"}, based on
   ${or(i.employeesBasis, "[basis]")}.

4. Information received
${lettered}

5. The preliminary checks I carried out, and their dates, are listed in
   Annexure A. I have not been able to verify the internal records of the
   establishment, which is why I request an inspection.

6. Request
   I respectfully request that you:
   (a) cause the establishment's records and workplace to be inspected
       under Section 25 of the Act;
   (b) take action under Section 26 if non-compliance is found; and
   (c) ensure that an Internal Committee is constituted in accordance
       with Section 4.

7. Confidentiality
   I request that the employer not be told that this information came from
   an employee, and that this letter not be shared with the employer.

8. I would be grateful for an acknowledgement and, in due course, for
   information on the action taken, quoting reference ${i.ref}.

Declaration: This information is submitted in good faith, in the interest
of women employees at the workplace, and is true to the best of my
knowledge and belief after the checks described in Annexure A.

Yours faithfully,

[Signature]
${or(i.operator.name, "[Your full name]")}

Enclosure: Annexure A (verification checklist)`;
}

export function letterMarathi(i: LetterInput) {
  const r = i.report;
  const f = facts(r, i.sheboxDate);
  const e = r.establishment;
  const items: string[] = [];
  if (f.noIc) items.push("अंतर्गत समिती गठित करण्यात आलेली नाही, किंवा तिच्या गठनाबाबत\n       कर्मचाऱ्यांना कळविण्यात आलेले नाही.");
  if (f.noDisplay) items.push("कामाच्या ठिकाणी लैंगिक छळाविषयीचे धोरण किंवा अंतर्गत समितीचा\n       तपशील प्रदर्शित केलेला नाही.");
  if (f.noTraining) items.push("जनजागृती किंवा प्रशिक्षण सत्रे आयोजित करण्यात आलेली नाहीत.");
  if (f.shebox) items.push(`SHe-Box पोर्टलवर या आस्थापनेची अंतर्गत समिती आढळून आली नाही\n       (शोध दिनांक: ${i.sheboxDate}).`);
  const marks = ["अ", "ब", "क", "ड"];
  const lettered = items.map((t, n) => `   (${marks[n]}) ${t}`).join("\n");

  const informant =
    r.filing === "named" && r.named
      ? `   ही माहिती खाली नमूद आस्थापनेत काम करणाऱ्या ${r.named.name} यांच्या\n   वतीने, त्यांच्या विनंतीनुसार सादर करण्यात येत आहे. त्यांचा संपर्क\n   तपशील स्वतंत्रपणे व गोपनीयरित्या जोडला आहे.`
      : `   खाली नमूद आस्थापनेत काम करणाऱ्या एका व्यक्तीकडून मला ही माहिती\n   मिळाली आहे. त्या व्यक्तीने आपली ओळख गोपनीय ठेवण्याची विनंती\n   केली असून, ती ओळख माझ्याकडे उपलब्ध नाही.`;

  return `${letterhead(i.operator)}

दिनांक: ${i.date}
आमचा संदर्भ क्रमांक: ${i.ref}

प्रति,
मा. जिल्हा अधिकारी
(कामाच्या ठिकाणी महिलांचा लैंगिक छळ (प्रतिबंध, मनाई आणि निवारण)
अधिनियम, २०१३)
जिल्हाधिकारी कार्यालय, ${i.district}

प्रत:
मा. जिल्हा महिला व बाल विकास अधिकारी, ${i.district}

विषय: ${e.name} येथे कामाच्या ठिकाणी महिलांचा लैंगिक छळ (प्रतिबंध, मनाई
आणि निवारण) अधिनियम, २०१३ च्या कलम ४ अन्वये अंतर्गत समिती गठित न
केल्याबाबत माहिती; कलम २५ अन्वये तपासणी करण्याबाबत विनंती

महोदय/महोदया,

१. मी ${or(i.operator.platform, "[प्लॅटफॉर्मचे नाव]")} ही लोकहितार्थ सेवा चालवतो/चालवते. या सेवेद्वारे
   महाराष्ट्रात काम करणाऱ्या व्यक्ती, POSH अधिनियम, २०१३ नुसार आवश्यक
   व्यवस्था न उभारलेल्या कामाच्या ठिकाणांची माहिती देऊ शकतात.

२.${informant.slice(2)}

३. आस्थापनेचा तपशील
   नाव: ${establishmentName(r)}
   कामाच्या ठिकाणाचा पत्ता: ${e.address}, ${i.district}
   या पत्त्यावरील अंदाजे कर्मचारी संख्या: ${RANGE_MR[e.employees] ?? "१० किंवा अधिक"}, आधार:
   ${or(i.employeesBasis, "[आधार]")}.

४. प्राप्त माहिती
${lettered}

५. मी केलेल्या प्राथमिक तपासण्या व त्यांचे दिनांक परिशिष्ट 'अ' मध्ये नमूद
   आहेत. आस्थापनेच्या अंतर्गत नोंदी मला तपासता आलेल्या नाहीत, म्हणून
   मी तपासणीची विनंती करत आहे.

६. विनंती
   आपणास नम्र विनंती आहे की:
   (अ) अधिनियमाच्या कलम २५ अन्वये आस्थापनेच्या नोंदी व कामाच्या
       ठिकाणाची तपासणी करण्यात यावी;
   (ब) अनुपालन न आढळल्यास कलम २६ अन्वये कारवाई करण्यात यावी; आणि
   (क) कलम ४ नुसार अंतर्गत समिती गठित होईल याची खात्री करण्यात यावी.

७. गोपनीयता
   ही माहिती कर्मचाऱ्याकडून आली असल्याचे नियोक्त्यास कळवू नये, तसेच
   हे पत्र नियोक्त्यास देऊ नये, ही विनंती.

८. कृपया या पत्राची पोच द्यावी आणि यथावकाश केलेल्या कारवाईची माहिती
   संदर्भ क्रमांक ${i.ref} नमूद करून कळवावी.

प्रतिज्ञापन: ही माहिती कामाच्या ठिकाणी असलेल्या महिला कर्मचाऱ्यांच्या हितासाठी,
सद्भावनेने सादर करण्यात येत असून, परिशिष्ट 'अ' मध्ये नमूद तपासण्यांनंतर
माझ्या माहितीनुसार व समजुतीनुसार सत्य आहे.

आपला/आपली विश्वासू,

[स्वाक्षरी]
${or(i.operator.name, "[पूर्ण नाव]")}

सोबत: परिशिष्ट 'अ' (पडताळणी यादी)`;
}

export function letterEscalation(i: LetterInput) {
  const e = i.report.establishment;
  return `Date: ${i.date}
Our reference: ${i.ref}

To,
The Collector and District Magistrate, ${i.district}

Copy to:
1. The District Officer (POSH Act), ${i.district}
2. The Commissioner, Women and Child Development, Maharashtra State, Pune

Subject: Reminder: information on non-constitution of the Internal Committee
at ${e.name}, submitted on ${or(i.firstLetterDate, "[date of first letter]")},
reference ${i.ref}

Respected Sir/Madam,

1. On ${or(i.firstLetterDate, "[date]")}, I submitted information to the District Officer that
   ${e.name} has not constituted an Internal Committee as
   required by Section 4 of the POSH Act, 2013, and requested an
   inspection under Section 25. A copy is enclosed with the postal
   receipt ${or(i.tracking, "[tracking number]")}.

2. As of today, 30 days later, I have received ${or(i.replyStatus, "no acknowledgement")}.

3. In view of the Supreme Court's directions in Aureliano Fernandes v.
   State of Goa (orders of 3 December 2024 and 12 August 2025) on
   district-level verification of Internal Committees, and the State's
   circular of 14 May 2026 on POSH inspections, I request that the matter
   be taken up and that I be informed of the action taken.

4. The request for confidentiality made in my original letter stands.

Yours faithfully,

[Signature]
${or(i.operator.name, "[Your full name]")}, ${or(i.operator.platform, "[Platform name]")}
${or(i.operator.email, "[email]")} | ${or(i.operator.phone, "[phone]")}

Enclosures: copy of letter dated ${or(i.firstLetterDate, "[date]")}; postal receipt`;
}

export function letterRti(i: LetterInput) {
  const e = i.report.establishment;
  return `To,
The Public Information Officer
Office of the Collector, ${i.district}

Application under Section 6(1) of the Right to Information Act, 2005

1. Applicant: ${or(i.operator.name, "[Your full name]")}, ${or(i.operator.address, "[postal address]")}, ${or(i.operator.email, "[email]")}
2. Fee: Rs. 10 [court-fee stamp affixed / IPO no. ____ / paid online]
3. Subject: Action taken on my letter dated ${or(i.firstLetterDate, "[date]")}, reference
   ${i.ref}, regarding non-constitution of the Internal Committee
   at ${e.name}, under the POSH Act, 2013.
4. Information sought (certified copies where documents exist):
   (a) The date of receipt and inward number of my letter dated ${or(i.firstLetterDate, "[date]")}.
   (b) The name and designation of the officer to whom it was marked.
   (c) Copies of file notings and correspondence on my letter.
   (d) Whether an inspection was ordered under Section 25 of the POSH
       Act; if so, the date of the order and the officer authorised.
   (e) The outcome of any inspection, including whether an Internal
       Committee has since been constituted at the establishment.
   (f) Any action taken under Section 26 of the POSH Act.
5. I am a citizen of India. I will pay any additional fee for copies.

Place: [place]
Date: ${i.date}

[Signature]
${or(i.operator.name, "[Your full name]")}`;
}

export const LETTERS = {
  english: { label: "Letter (English)", make: letterEnglish },
  marathi: { label: "Letter (Marathi)", make: letterMarathi },
  escalation: { label: "Escalation (day 30)", make: letterEscalation },
  rti: { label: "RTI (day 45)", make: letterRti },
} as const;
export type LetterKind = keyof typeof LETTERS;
