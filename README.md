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

## Security notes

- Public sign-up is disabled; only a Super Admin creates accounts.
- The service-role key is used only in server code: creating users, the
  rate limiter, and the public result/certificate lookups (so per-client rate
  limits cannot be bypassed). It is never exposed to the browser.
- Public result search returns only published results and only public fields
  (no parents' names, contact details, date of birth or ID numbers).
  Registration numbers are random to prevent enumeration.
- National ID / birth registration numbers are never exported and are
  redacted from the audit trail. Uploaded files live in a private bucket and
  are served via 60-second signed URLs.
- CMS Markdown is rendered without raw HTML; CMS URLs are restricted to
  `https://` or site paths at both app and database level.

## Deploying (Vercel + Supabase)

1. Create a Supabase project; run `supabase link --project-ref <ref>` and
   `supabase db push` to apply `supabase/migrations` (do **not** run `seed.sql`
   in production).
2. In Supabase Auth settings: disable sign-ups, set the Site URL to the
   production domain, configure SMTP for password-reset emails.
3. Create a Vercel project from this repository and set
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (server-only) and `NEXT_PUBLIC_SITE_URL`.
4. Bootstrap the first Super Admin from a trusted machine:
   `SEED_SUPER_ADMIN_EMAIL=… SEED_SUPER_ADMIN_PASSWORD=… npm run seed:users`
   (with the production URL and service key in the environment).
5. Sign in, then set the organization identity in **Site settings**.
