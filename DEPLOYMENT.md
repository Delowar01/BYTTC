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
supabase db push --dry-run          # lists the 8 migrations
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
5. Storage buckets (`public-media`, `private-documents`) are created by the
   migrations — nothing to do.

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

## 4. Acceptance on staging

Run the browser checklist in `ACCEPTANCE.md` with the files in `samples/`.

## Production (later, only with explicit approval)

Same steps with a new production Supabase project (Pro plan with Point-in-Time
Recovery), **without** `--include-seed`, environment variables in Vercel's
**Production** scope and the production domain. Schedule `scripts/backup.sh`
(see README → Backups and recovery).
