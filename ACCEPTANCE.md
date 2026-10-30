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
