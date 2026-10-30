# TTIMS — Technical Training Institute Management System

A bilingual (Bangla / English) website and management platform for a network of
technical training institutes: public website with CMS, institute directory,
result search and certificate verification, plus a Super Admin console with
bulk result upload and a controlled publication workflow.

> **Branding.** The default organization name ("Sarathi Technical Training
> Network") is a placeholder. Before going live, set the legal name of the
> actual issuing organization, its logo, contact details and the accreditation
> disclaimer in **Admin → Site settings**. Do not claim government
> accreditation unless the organization is authorized to.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 ·
shadcn/ui components · Supabase (PostgreSQL, Auth, Storage, RLS) · Vercel.

## Local development

Prerequisites: Node 20.9+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start                      # local Postgres, Auth, Storage, API
cp .env.example .env.local          # fill keys from `supabase status`
supabase db reset                   # apply migrations + synthetic seed data
npm install
npm run seed:users -- --test-users  # Super Admin + role test accounts (local only)
npm run dev                         # http://localhost:3000, staff login at /login
```

Quote env values that contain `#` (Node's env-file parser treats an unquoted
`#` as a comment).

Local test accounts (password = `SEED_SUPER_ADMIN_PASSWORD`):

| Email | Role |
| --- | --- |
| superadmin@example.org | Super Admin |
| central.admin@example.org | Central Admin (can publish) |
| central.staff@example.org | Central Staff (cannot publish) |
| dhk.admin@example.org / dhk.staff@example.org | Institute admin / staff (DHK-001) |
| ctg.admin@example.org | Institute admin (CTG-001) |
| khl.admin@example.org | Institute admin of a **suspended** institute (no access) |

All seed data (institutes, students, results) is synthetic.

## Tests

```bash
npm test           # unit tests + database security tests (needs local Supabase)
npm run test:e2e   # Playwright end-to-end tests (needs `npm run build` or a running app)
npm run lint && npm run typecheck
```

- `tests/unit` — spreadsheet parsing (CSV/XLSX, size/type/encoding checks),
  result and student row validation, CSV injection, URL safety.
- `tests/db` — runs real queries as each role: RLS and tenant isolation,
  publication guard, no auto-publish, correction reasons, audit trail,
  atomic batch commit, full batch lifecycle.
- `tests/e2e` — browser flows: login, CRUD, institute approval, CMS edits,
  bulk result upload (errors → commit → publish → public search → unpublish →
  rollback), student import, bilingual public site, rate limiting, mobile layout.

## Roles and permissions

Enforced twice: in server actions (`assertRole`) and in the database (RLS
policies, triggers and RPC checks).

| Capability | Super Admin | Central Admin | Central Staff | Institute Admin | Institute Staff |
| --- | :-: | :-: | :-: | :-: | :-: |
| Students (CRUD, import, export) | all | all | all | own institute, assigned courses | own institute (no delete) |
| Institutes, courses, sessions, exams | ✓ | ✓ | ✓ (no delete) | – | – |
| Approve / suspend institutes | ✓ | ✓ | – | – | – |
| Upload results / marks entry | ✓ | ✓ | ✓ | own institute → submit for review | own institute → submit for review |
| Publish / unpublish / correct published results | ✓ | ✓ | – | – | – |
| Course assignments per institute | ✓ | ✓ | – | read | read |
| CMS, grading rules, audit log | ✓ | ✓ | – | – | – |
| User accounts | all | institute accounts | – | own staff | – |

A suspended institute's users lose all data access immediately.

## Institute onboarding

1. An institute applies online at `/apply` (bilingual form, rate limited).
   Supporting documents go to the private bucket; the application is stored
   as a **pending** institute and never shown publicly.
2. Central staff review it under **Institutes** (documents open through
   60-second signed links, every view is logged), set the permanent institute
   code, assign courses and **approve** (or reject with a reason).
3. Activation: on the approved institute's page, a Central/Super Admin creates
   the **institute admin** account with a temporary password. The institute
   admin changes it under **My account** and can add **staff** accounts.
4. Institute users register students (only in assigned courses), enter marks
   (**Marks entry**) or upload files, and **submit** drafts for review. Only
   central publishers can publish.

## Bulk result upload

1. **Template** — Admin → Bulk result upload → download the Excel template
   (also lists current exam and institute codes) or the CSV template.
2. **Upload & validate** — `.xlsx` or `.csv`, max 4 MB / 20,000 rows. Every row
   is checked: required columns, roll + registration match, institute
   (exists, approved, is the student's), course, exam (exists, active, belongs
   to the course), marks (numeric, ≤ full marks, ≤ 2 decimals), duplicates in
   the file, and results that already exist. All errors are listed (and
   downloadable as CSV). Files with errors cannot be committed.
3. **Commit** — all rows are inserted in one database transaction as
   **draft** results. The database refuses to create published results, so
   imports can never auto-publish.
4. **Publish / unpublish** — only Super/Central Admins. Published results
   appear in public search (roll + registration number, public fields only).
5. **Corrections** — editing a published result requires a reason; the
   version number increments and the before/after values are audited.
6. **Rollback** — committed or unpublished batches can be rolled back (reason
   required). The original file, SHA-256 and full status history are kept.

## Certificates

- **Issue** — Admin → Certificates → choose an exam: every published, passing
  result without a certificate gets one (or issue a single one from the
  result page). Numbers look like `STTN-26-7KQ2M9XA`: random, unguessable and
  unique. The credential data is **snapshotted** at issue time.
- **PDF** — A4 landscape with the organization name, logo (PNG/JPEG), title,
  signatory labels and disclaimer from Site settings, plus a QR code linking to
  `/verify?no=<number>`. Bangla organization and student names are shaped with
  HarfBuzz (WASM) and drawn with Noto Sans Bengali (SIL OFL, see
  `src/assets/fonts/OFL.txt`).
- **Verify** — `/verify` (public, rate limited) shows valid / revoked status and
  the permitted credential fields only.
- **Correct / revoke** — *Reissue* revokes the current certificate and issues a
  new number linked to it (verification of the old number points to the new
  one); *Revoke* requires a reason. Results with a valid certificate cannot be
  unpublished until the certificate is revoked.

## Reports, exports and printing

Admin → Reports: results by exam (status counts, pass rate, grade
distribution) and by institute, exportable to Excel. Results can be exported
(Excel/CSV) and printed as a tabulation sheet per exam. Institute users get
only their own figures (the report functions run under RLS).

## Password reset

`/forgot-password` sends a one-hour, single-use link (same response for
unknown emails). The link is verified server-side at `/auth/confirm`, the user
sets a new password at `/reset-password`, and all sessions are signed out.
In production, paste `supabase/templates/recovery.html` into
**Auth → Email Templates → Reset password** and configure SMTP.

## Backups and recovery

- Primary: Supabase managed daily backups (enable Point-in-Time Recovery on
  production).
- Portable logical backup: `scripts/backup.sh` (roles, schema, data incl. auth
  users, every storage file, SHA-256 manifest). Store it encrypted, off-site.
- Restore: `scripts/restore.sh <backup-dir>` into a **new, empty** project after
  `supabase db push`. It verifies checksums, refuses to touch a database that
  already has users or students, restores rows in one transaction and
  re-uploads files. A local drill (wipe → restore) reproduced every count and
  restored users could sign in.

## Security notes

- Public sign-up is disabled; only a Super Admin creates accounts.
- The service-role key is used only in server code: creating users, the
  rate limiter, and the public result/certificate lookups (so per-client rate
  limits cannot be bypassed). It is never exposed to the browser.
- Public result search returns only published results and only public fields
  (no parents' names, contact details, date of birth or ID numbers).
  Registration numbers are random to prevent enumeration.
- National ID / birth registration numbers are never exported and are
  redacted from the audit trail. Import files, application documents and
  student documents live in a private bucket (storage RLS limits institutes to
  their own folder) and are served via 60-second signed URLs; views are logged.
- Anonymous visitors can execute only three database functions
  (`public_institutes`, `public_stats`, `is_safe_url`); a test pins this list.
- A nonce-based Content Security Policy is sent with every page
  (`src/lib/csp.ts`); file downloads are excluded.
- CMS Markdown is rendered without raw HTML; CMS URLs are restricted to
  `https://` or site paths at both app and database level.

## Deploying

- Staging (Vercel Preview + separate Supabase project), the first Super Admin
  procedure and production notes: [DEPLOYMENT.md](DEPLOYMENT.md).
- Browser acceptance checklist: [ACCEPTANCE.md](ACCEPTANCE.md), using the
  synthetic sample files in [samples/](samples/README.md).
