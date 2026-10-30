# Staging deployment (Vercel + Supabase)

Staging only. It uses a **separate** Supabase project and a Vercel **Preview**
deployment, so nothing touches production. Synthetic seed data is optional
and only for staging. No step requires sharing keys or passwords with anyone:
you enter them directly in the Supabase and Vercel dashboards.

## What you must provide

| # | Item | Where it goes |
| --- | --- | --- |
| 1 | A new Supabase project for staging (suggested region: Singapore) and its **database password** | Supabase dashboard; typed into `supabase link` on your machine |
| 2 | Supabase **Project URL**, **anon** key and **service_role** key (Project Settings → API Keys; tested with the legacy JWT keys) | Vercel environment variables (Preview) |
| 3 | The staging URL testers will use (Vercel branch URL or e.g. `https://staging.example.org`) | `NEXT_PUBLIC_SITE_URL` and Supabase Auth → URL Configuration |
| 4 | SMTP credentials (any transactional email provider) — needed for password-reset emails | Supabase Auth → Emails → SMTP |
| 5 | First Super Admin email and a strong password (password manager) | Supabase dashboard only (procedure below) |
| 6 | Issuing organization's legal name (EN/BN), logo, disclaimer, certificate signatory titles | Admin → Site settings, after first login |

## 1. Supabase (staging project)

On your own machine, from a checkout of this branch:

```bash
supabase login
supabase link --project-ref <staging-project-ref>
supabase db push --dry-run          # lists the 11 migrations
supabase db push --include-seed     # staging only: schema + synthetic demo data
```

Omit `--include-seed` for an empty staging database (the sample import files
in `samples/` need the seed data).

In the Supabase dashboard of the **staging** project:

1. **Authentication → Sign In / Providers**: turn **off** “Allow new users to
   sign up”; keep the **Email** provider **enabled**.
2. **Authentication → URL Configuration**: Site URL = the staging URL; add
   `<staging URL>/**` to Redirect URLs.
3. **Authentication → Emails → SMTP Settings**: enter your SMTP provider.
4. **Authentication → Emails → Templates → Reset Password**: subject
   “Reset your password”, body = contents of `supabase/templates/recovery.html`.
5. Storage buckets (`public-media`, `private-documents`, `document-templates`)
   are created by the migrations — nothing to do.

## 2. Vercel (Preview deployment)

1. **Add New → Project → Import** `Delowar01/BYTTC`. Framework: Next.js
   (auto). Node.js version: 22.x. Do not change the build command.
2. **Settings → Environment Variables**, scope **Preview** only:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key — mark **Sensitive** |
   | `NEXT_PUBLIC_SITE_URL` | the staging URL (no trailing slash) |

3. Deploy the branch `claude/optimistic-mccarthy-ube7y7` (pushing to it
   creates a Preview deployment). The production branch is not used.
4. Keep **Deployment Protection** (Vercel Authentication) on for staging so
   only invited testers can open it.

## 3. First Super Admin (secure procedure)

Done entirely in the Supabase dashboard; the service-role key never leaves
Vercel and no password is written to a file.

1. **Authentication → Users → Add user → Create new user**: the admin's
   email, a strong unique password from a password manager, tick
   **Auto Confirm User**.
2. **SQL Editor** (replace the email and name):

   ```sql
   insert into public.profiles (id, email, full_name, role)
   select id, email, 'Full Name', 'super_admin'
   from auth.users where email = 'admin@your-organization.example';
   ```

3. Open `<staging URL>/login`, sign in, and set the organization identity in
   **Admin → Site settings**.
4. Create every other person their own account in **Admin → Users** — never
   share the Super Admin login. Disable accounts that are no longer needed.

Alternative from a trusted terminal (values typed into the shell, not saved):
`NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SEED_SUPER_ADMIN_EMAIL=… SEED_SUPER_ADMIN_PASSWORD=… npm run seed:users`.
`--test-users` refuses to run against non-local projects.

## Upgrading an existing staging database (academic documents release)

For a staging project that already has the first 8 migrations. All three new
migrations are additive: new columns (with defaults/backfills), new tables,
a private `document-templates` bucket and replaced functions. No existing
results, certificates or students are deleted, and published results keep
their marks, grades and publication time (`first_published_at` is copied
from `published_at`).

1. **Approval first** — this changes the hosted staging database; run it only
   after you approve the upgrade. Update your checkout first
   (`git pull origin claude/academic-documents-upgrade`): an earlier version
   of these migrations failed on databases that already had published results
   (see *Retry after the failed attempt* below).
2. **Backup** — run `scripts/backup.sh` from your own terminal (it needs the
   database connection string, project URL and service-role key typed into
   the shell; see README → Backups and recovery). It saves the database and
   every storage bucket. Note the latest dashboard backup/PITR point too.
3. **Dry run** from a checkout of `claude/academic-documents-upgrade`:

   ```bash
   supabase link --project-ref <staging-project-ref>
   supabase db push --dry-run
   ```

   It must list exactly `20261031000100_academic_records.sql`,
   `20261031000200_public_results.sql` and `20261031000300_documents.sql`.
   Anything else → stop.
4. **Apply** — `supabase db push` (never `--include-seed` on a database
   with real data; never `db reset`).
5. **Verify (read-only)** — paste `scripts/verify-upgrade.sql` into the SQL
   Editor; every value must match the *expected* column.
6. **Deploy the app** — point the Vercel Preview at
   `claude/academic-documents-upgrade` (same environment variables). The old
   app keeps working against the upgraded schema until then, except that
   result corrections need the new screens.
7. **Recovery** — if anything is wrong, use the dashboard's backup/PITR
   restore, or `scripts/restore.sh` into a new, empty project and point the
   app at it; do not hand-edit migrations that were applied.

### Retry after the failed attempt

The first attempt stopped in `20261031000100_academic_records.sql` with
“Institute users can only save draft or submitted results”. Its backfill
updated existing published results, and the existing result guard does not
recognize the CLI's migration login, so it rejected the update; Postgres rolled
the whole migration back. The fixed migrations run their backfills with the
table's user triggers switched off (owner-only, inside the same transaction)
and record one audit entry per backfill instead. `npm run test:upgrade`
reproduces the staging situation locally and now passes.

Before retrying, confirm the rollback left nothing behind (read-only, SQL
Editor):

```sql
select
  (select count(*) from supabase_migrations.schema_migrations where version >= '20261031000000') as new_migrations_recorded,  -- expect 0
  to_regclass('public.grade_scales') as grade_scales_table,                                                                -- expect null
  to_regclass('public.document_templates') as templates_table,                                                             -- expect null
  (select tableowner from pg_tables where schemaname = 'public' and tablename = 'results') as results_owner,                -- expect postgres
  (select count(*) from public.results where status = 'published') as published_results,                                  -- note it (20)
  (select count(*) from public.certificates where status = 'valid') as valid_certificates;                                -- note it
```

If any value differs from the expectation, stop and share the output. Then
continue with steps 2–5 above; in step 5 the published-results and
valid-certificates counts must equal the numbers you noted.

After the upgrade: Admin → Document templates shows active built-in
templates for marksheets, admit cards and registration cards; certificates
keep the original design until a certificate template is activated. Upload
only blank designs and signatures you are authorized to use.

## 4. Acceptance on staging

Run the browser checklist in `ACCEPTANCE.md` with the files in `samples/`.

## Production (later, only with explicit approval)

Same steps with a new production Supabase project (Pro plan with Point-in-Time
Recovery), **without** `--include-seed`, environment variables in Vercel's
**Production** scope and the production domain. Schedule `scripts/backup.sh`
(see README → Backups and recovery).
