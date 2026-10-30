# Sample import files (synthetic data)

These files contain **fictitious** students that exist only in the synthetic
seed data (`supabase/seed.sql`). Use them on a local or **staging** database
loaded with that seed — never with real student records.

| File | Upload at | Expected result |
| --- | --- | --- |
| `results-import-valid.xlsx` | Admin → Bulk result upload | 6 valid rows, 0 errors. Commit saves 6 **draft** results for exam `COA-2026-DEC`. After publishing: 200045 A+, 200046 A, 200047 F (fail), 200054 A+, 200055 B, 200056 A. |
| `results-import-with-errors.xlsx` | Admin → Bulk result upload | 1 valid row, 6 rows with errors (marks above full marks, wrong registration, duplicate, unknown roll, wrong institute, unknown exam). Cannot be committed — discard it. |
| `students-import-sample.xlsx` | Admin → Students → Import | 3 valid rows; roll and registration numbers are generated on commit. |

Public result lookup after publishing, e.g. roll `200054`, registration `2600000054`.

Regenerate with `npx tsx scripts/make-samples.ts`. `tests/e2e/samples.spec.ts`
checks that the files still validate exactly as described.
