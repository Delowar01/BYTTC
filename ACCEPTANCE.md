# Browser acceptance checklist (staging)

Use a staging database with the synthetic seed data and the files in
`samples/`. Tick each step; every step names what you should see.

1. **Super Admin login** — open `/login`, sign in. ☐ Dashboard shows counts
   for institutes, students, courses and published results.
2. **Student creation** — Students → New student: institute `DHK-001`, course
   `COA`, session `July–December 2026`, a name, leave roll/registration blank,
   Save. ☐ “Student saved.” with generated roll and 10-digit registration number.
   ☐ Searching the name in Students finds it.
3. **Excel import** — Bulk result upload → upload
   `samples/results-import-with-errors.xlsx`. ☐ 6 rows with errors listed,
   no Commit button → Discard. Upload `samples/results-import-valid.xlsx`.
   ☐ 6 valid rows, 0 errors → **Commit 6 results as draft**.
   ☐ “6 results saved as draft.”
4. **Draft review** — on the batch page click View results.
   ☐ 6 rows with status *draft* and computed grades (200047 = F).
   ☐ Public Result Search for roll `200054`, registration `2600000054` shows
   **no** December result yet (drafts are never public).
5. **Result publication** — batch page → **Publish results**.
   ☐ “6 results published.”; batch status *published*.
6. **Public result lookup** — `/results`, roll `200054`, registration
   `2600000054`. ☐ Card “Computer Office Application — Final (Dec 2026)”,
   total 96/100, grade **A+**, Passed; no phone, parents or date of birth shown.
   ☐ Wrong registration number → “No published result…”.
7. **Certificate issuance** — Certificates → choose exam `COA-2026-DEC` →
   Issue certificates. ☐ “5 certificate(s) issued” (the failed student gets
   none). ☐ PDF opens: organization name, student name, course, grade,
   certificate number and QR code.
8. **QR verification** — scan the PDF's QR code with a phone (or open
   `/verify?no=<number>`). ☐ “This certificate is authentic and valid.”
   ☐ Revoke it (Certificates → Revoke, give a reason) → verifying again shows
   **REVOKED**.
9. **Mobile** — repeat steps 1 and 6 on a phone. ☐ No sideways page scrolling;
   menus open from the ☰ button.

## Academic documents upgrade (staging, after `scripts/verify-upgrade.sql`)

Use fictional data and blank designs you made yourself.

10. **Student record** — open a student: add thana, district, passport
    number, passing year; upload a photo. ☐ Photo shows; passport is never
    shown on public pages.
11. **Single result** — Results → Add single result → find the student →
    choose an exam → enter Written/Practical/Viva. ☐ Live preview → *Save as
    draft* → *Publish result*.
12. **Correction** — on the published result change a mark and the displayed
    publication date with a reason. ☐ Totals/grade recalculated; the reason
    is in the audit list; Result corrections lists it.
13. **Public search** — `/results` with Roll + Registration, Passport + Roll
    and Passport + Registration. ☐ Same result each time; a passport with a
    wrong second identifier finds nothing. ☐ *Download result sheet* gives a
    PDF whose QR opens “valid”.
14. **Templates** — Document templates → *Create draft* (Admit card) →
    upload a blank PNG/JPG/PDF design → drag fields into place → *Save* →
    *Preview PDF* (stamped SAMPLE) → *Activate*. ☐ The previous version shows
    *archived*.
15. **Admit cards** — Admit cards → choose the exam → *Issue admit cards*.
    ☐ PDF uses the design; QR → “valid”. ☐ Open a card → *Reissue* with a new
    seat → old number verifies “superseded”; *Revoke* → “REVOKED”.
16. **Registration cards** — filter course/session → issue with a validity
    date. ☐ *Download all* gives one page per student; QR → “valid”.
17. **Certificate template** — duplicate the certificate template, upload a
    design, activate; issue or reissue a certificate. ☐ PDF uses the design;
    certificates issued earlier still verify.
18. **Institute view** — sign in as an institute admin. ☐ Only that
    institute's cards and results are listed; no issue buttons.

## Upgrade test record (local, fictional data)

Automated on a freshly reset local database (`supabase db reset` + seed):
unit + database tests (`npm test`) and Playwright desktop/mobile
(`npm run test:e2e`). Hosted staging was **not** migrated or tested.

| # | Criterion | Covered by |
| --- | --- | --- |
| 1 | Student with optional passport and photo | e2e `academic.spec` |
| 2–4 | Manual result → draft → publish | e2e `academic.spec` |
| 5 | Post-publication edit with required reason | e2e `academic.spec`; db `results-workflow`, `academic` |
| 6 | Displayed publication date vs. immutable history | e2e `academic.spec`; db `academic` |
| 7 | Excel import, then correct an imported record | e2e `import.spec` |
| 8 | Duplicate result prevention | e2e `academic.spec`, `import.spec`; db `academic` |
| 9 | Written/Practical/Viva calculations | unit `results-validation`; db `academic` |
| 10 | 4.00 and 5.00 grade scales | db `academic`; e2e `academic.spec` |
| 11–13 | Roll+Reg, Passport+Roll, Passport+Reg search | e2e `public-results.spec`; db `public-results` |
| 14 | Passport never disclosed | db `public-results`, `academic`; e2e `public-results.spec` |
| 15 | Expanded public result with authorized details/photo | e2e `public-results.spec`; db `public-results` |
| 16 | Marksheet PDF (public, single, bulk) | e2e `public-results.spec`, `documents.spec` |
| 17–18 | Blank certificate design, mapping, generation | e2e `documents.spec` |
| 19 | Blank marksheet design (PDF) | e2e `documents.spec` |
| 20 | Admit card on an uploaded design | e2e `documents.spec` |
| 21 | Registration card on an uploaded design | e2e `documents.spec` |
| 22 | QR codes and validity (valid/revoked/superseded/expired) | e2e `documents.spec`, `public-results.spec`; db `documents` |
| 23 | Reissue/revoke | e2e `documents.spec`, `phase3.spec`; db `documents` |
| 24 | Earlier certificates still verify | e2e `documents.spec`; db `documents` |
| 25 | Published results unchanged unless corrected | db `academic`, `public-results` |
| 26 | Institute data isolation | db `rls`, `documents`; e2e `documents.spec`, `phase3.spec` |
| 27 | Mobile views | e2e `mobile-admin.spec`, `public.spec` (Pixel 7) |
| 28 | Unit, database, security and browser tests | `npm test`, `npm run test:e2e` |
