import type { DocType, MarksRow } from "./types";

/** Tokens available in templates, with fictional sample values for previews. */
export type TokenDef = { key: string; label: string; sample: string };

const COMMON: TokenDef[] = [
  { key: "org_name", label: "Organization name", sample: "Sarathi Technical Training Network" },
  { key: "org_name_bn", label: "Organization name (Bangla)", sample: "সারথি টেকনিক্যাল ট্রেনিং নেটওয়ার্ক" },
  { key: "org_registration_no", label: "Organization registration no.", sample: "REG-0000-SAMPLE" },
  { key: "org_tagline", label: "Organization tagline", sample: "Practical skills. Verified results." },
  { key: "disclaimer", label: "Issuer disclaimer", sample: "This is a private, non-government training network." },
  { key: "document_no", label: "Document / serial number", sample: "STTN-26-SAMPLE01" },
  { key: "issue_date", label: "Issue date", sample: "30 October 2026" },
  { key: "verify_code", label: "Verification code", sample: "SAMPLE7KQ2M9X" },
  { key: "verify_url", label: "Verification link", sample: "https://example.org/verify?no=STTN-26-SAMPLE01" },
  { key: "student_name", label: "Student name", sample: "Rafiq Ahmed (Sample)" },
  { key: "student_name_bn", label: "Student name (Bangla)", sample: "রফিক আহমেদ" },
  { key: "father_name", label: "Father's name", sample: "Karim Ahmed" },
  { key: "mother_name", label: "Mother's name", sample: "Salma Begum" },
  { key: "date_of_birth", label: "Date of birth", sample: "14 March 2004" },
  { key: "gender", label: "Gender", sample: "Male" },
  { key: "roll_no", label: "Roll number", sample: "100123" },
  { key: "registration_no", label: "Registration number", sample: "2612345678" },
  { key: "institute_name", label: "Institute name", sample: "Sample Technical Institute" },
  { key: "institute_code", label: "Institute code", sample: "SMP-001" },
  { key: "institute_registration_no", label: "Institute registration no.", sample: "INST-REG-0042" },
  { key: "course_title", label: "Course name", sample: "Diploma in Computer Science & ICT" },
  { key: "course_code", label: "Course code", sample: "DCS" },
  { key: "course_duration", label: "Course duration", sample: "1 Year" },
  { key: "session_name", label: "Session", sample: "January–December 2026" },
  { key: "signatory_left", label: "Left signatory title", sample: "Controller of Examinations" },
  { key: "signatory_right", label: "Right signatory title", sample: "Director" },
];

const RESULT: TokenDef[] = [
  { key: "exam_name", label: "Examination", sample: "Final Examination (Dec 2026)" },
  { key: "exam_code", label: "Exam code", sample: "DCS-2026-DEC" },
  { key: "exam_date", label: "Exam date", sample: "20 December 2026" },
  { key: "passing_year", label: "Passing year", sample: "2026" },
  { key: "published_on", label: "Result publication date (displayed)", sample: "16 January 2027" },
  { key: "theory_marks", label: "Written marks", sample: "122" },
  { key: "practical_marks", label: "Practical marks", sample: "19" },
  { key: "viva_marks", label: "Viva marks", sample: "17" },
  { key: "total_marks", label: "Total marks", sample: "158" },
  { key: "full_marks", label: "Full marks", sample: "200" },
  { key: "percentage", label: "Percentage", sample: "79" },
  { key: "grade", label: "Letter grade", sample: "A" },
  { key: "grade_point", label: "Grade point", sample: "3.75" },
  { key: "scale_max", label: "Scale maximum", sample: "4.00" },
  { key: "gpa_text", label: "GPA text", sample: "CGPA 3.75 on a scale of 4.00" },
  { key: "result_status", label: "Result (Passed/Failed)", sample: "Passed" },
  { key: "grading_text", label: "Grading scale summary", sample: "A+ 80%+ · A 75%+ · A- 70%+ · B+ 65%+" },
];

const ADMIT: TokenDef[] = [
  { key: "exam_name", label: "Examination", sample: "Final Examination (Dec 2026)" },
  { key: "exam_date", label: "Exam date", sample: "20 December 2026" },
  { key: "exam_time", label: "Exam time", sample: "10:00 AM" },
  { key: "venue", label: "Venue", sample: "Sample Technical Institute, Hall 2" },
  { key: "seat_no", label: "Seat number", sample: "A-17" },
  { key: "examinee_type", label: "Type of examinee", sample: "Regular" },
];

const REGISTRATION: TokenDef[] = [
  { key: "address", label: "Address", sample: "12 Sample Road" },
  { key: "thana", label: "Thana", sample: "Sample Thana" },
  { key: "district", label: "District", sample: "Sample District" },
  { key: "enrollment_date", label: "Registration date", sample: "05 January 2026" },
  { key: "valid_until", label: "Valid until", sample: "05 January 2034" },
];

export const TOKENS: Record<DocType, TokenDef[]> = {
  certificate: [...COMMON, ...RESULT],
  marksheet: [...COMMON, ...RESULT],
  admit_card: [...COMMON, ...ADMIT],
  registration_card: [...COMMON, ...REGISTRATION],
};

export function sampleData(type: DocType, siteUrl: string): Record<string, string> {
  const data = Object.fromEntries(TOKENS[type].map((t) => [t.key, t.sample]));
  return { ...data, verify_url: `${siteUrl.replace(/\/$/, "")}/verify?no=${data.document_no}` };
}

export const SAMPLE_MARKS: MarksRow = { theory: "122", practical: "19", viva: "17", total: "158", full: "200", grade: "A", point: "3.75" };

/** Replace {tokens} with data values; reports whether every token was empty. */
export function fillTemplate(text: string, data: Record<string, string | undefined>) {
  let tokens = 0;
  let filled = 0;
  const out = text.replace(/\{([a-z0-9_]+)\}/g, (_, key: string) => {
    tokens++;
    const v = data[key] ?? "";
    if (v !== "") filled++;
    return v;
  });
  return { text: out, empty: tokens > 0 && filled === 0 };
}
