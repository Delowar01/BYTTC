-- =============================================================================
-- Technical Training Institute Management System (TTIMS) — core schema
-- Phase 1: institutes, courses, sessions, exams, students, results, imports,
--          CMS, audit trail. All tables are protected by Row Level Security.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'super_admin',      -- full control, user management, settings
  'central_admin',    -- central operations, may publish results
  'central_staff',    -- central data entry, may NOT publish results
  'institute_admin',  -- tenant administrator (own institute only)
  'institute_staff'   -- tenant data entry (own institute only)
);
create type public.institute_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.student_status   as enum ('active', 'completed', 'dropped');
create type public.result_status    as enum ('draft', 'submitted', 'published', 'unpublished');
create type public.batch_status     as enum ('validated', 'committed', 'published', 'unpublished', 'rolled_back', 'failed');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Institutes (tenants)
-- ---------------------------------------------------------------------------
create table public.institutes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name_en          text not null check (length(name_en) between 2 and 200),
  name_bn          text,
  head_name        text,
  email            text,
  phone            text,
  address          text,
  district         text,
  established_year int check (established_year between 1900 and 2100),
  status           public.institute_status not null default 'pending',
  remarks          text,
  approved_at      timestamptz,
  approved_by      uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index institutes_status_idx on public.institutes (status);
create trigger institutes_updated_at before update on public.institutes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, carries role and tenant
-- (created only by privileged server code; public sign-up is disabled)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  role         public.app_role not null,
  institute_id uuid references public.institutes (id) on delete restrict,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_tenant_role_ck check (
    (role in ('institute_admin', 'institute_staff')) = (institute_id is not null)
  )
);
create index profiles_institute_idx on public.profiles (institute_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so they can read profiles under RLS)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = any (roles)
  );
$$;

create or replace function public.is_central() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(array['super_admin', 'central_admin', 'central_staff']::public.app_role[]);
$$;

-- Only these roles may publish / unpublish / correct published results
create or replace function public.can_publish() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(array['super_admin', 'central_admin']::public.app_role[]);
$$;

create or replace function public.is_cms_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(array['super_admin', 'central_admin']::public.app_role[]);
$$;

-- Tenant of the current user; NULL unless the user is an active institute
-- user AND the institute is approved (suspension revokes tenant access).
create or replace function public.current_institute_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.institute_id
  from public.profiles p
  join public.institutes i on i.id = p.institute_id
  where p.id = auth.uid() and p.is_active and i.status = 'approved';
$$;

-- True for trusted backend connections (migrations, seeds, service role).
-- Uses session_user: inside SECURITY DEFINER functions current_user is the
-- function owner, which must not count as a backend connection.
create or replace function public.is_backend() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;

-- ---------------------------------------------------------------------------
-- Audit trail (append-only; written by triggers / SECURITY DEFINER functions)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  action      text not null,
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  reason      text
);
create index audit_logs_occurred_idx on public.audit_logs (occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  -- never copy personal identity numbers into the audit trail
  redact constant text[] := array['national_id'];
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data, reason)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id', ''),
    case when tg_op <> 'INSERT' then to_jsonb(old) - redact end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - redact end,
    nullif(current_setting('app.change_reason', true), '')
  );
  return coalesce(new, old);
end $$;

-- Explicit application-level events (publish, rollback, approvals, ...)
create or replace function public.log_event(p_action text, p_table text, p_record_id text, p_data jsonb default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null and not public.is_backend() then
    raise exception 'Not authenticated';
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data, reason)
  values (auth.uid(), p_action, p_table, p_record_id, p_data, p_reason);
end $$;

create trigger institutes_audit after insert or update or delete on public.institutes
  for each row execute function public.audit_trigger();
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- Courses, academic sessions, exams, grading rules
-- ---------------------------------------------------------------------------
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  title_en        text not null,
  title_bn        text,
  summary_en      text,
  summary_bn      text,
  description_en  text,
  description_bn  text,
  duration_months int check (duration_months between 1 and 60),
  fee             numeric(10, 2) check (fee >= 0),
  image_url       text,
  is_published    boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
create trigger courses_audit after insert or update or delete on public.courses
  for each row execute function public.audit_trigger();

create table public.academic_sessions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  start_date date,
  end_date   date,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);
create trigger sessions_updated_at before update on public.academic_sessions
  for each row execute function public.set_updated_at();
create trigger sessions_audit after insert or update or delete on public.academic_sessions
  for each row execute function public.audit_trigger();

create table public.exams (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null unique check (code ~ '^[A-Z0-9-]{2,30}$'),
  name                 text not null,
  course_id            uuid not null references public.courses (id) on delete restrict,
  session_id           uuid not null references public.academic_sessions (id) on delete restrict,
  exam_date            date,
  theory_full_marks    numeric(6, 2) not null default 70 check (theory_full_marks >= 0),
  practical_full_marks numeric(6, 2) not null default 30 check (practical_full_marks >= 0),
  pass_marks           numeric(6, 2) not null default 40 check (pass_marks >= 0),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (theory_full_marks + practical_full_marks > 0),
  check (pass_marks <= theory_full_marks + practical_full_marks)
);
create index exams_course_idx on public.exams (course_id);
create index exams_session_idx on public.exams (session_id);
create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();
create trigger exams_audit after insert or update or delete on public.exams
  for each row execute function public.audit_trigger();

create table public.grade_rules (
  id          serial primary key,
  min_percent numeric(5, 2) not null unique check (min_percent between 0 and 100),
  grade       text not null,
  grade_point numeric(3, 2) not null check (grade_point between 0 and 5),
  created_at  timestamptz not null default now()
);
create trigger grade_rules_audit after insert or update or delete on public.grade_rules
  for each row execute function public.audit_trigger();

insert into public.grade_rules (min_percent, grade, grade_point) values
  (80, 'A+', 5.00), (70, 'A', 4.00), (60, 'A-', 3.50),
  (50, 'B', 3.00), (40, 'C', 2.00), (0, 'F', 0.00);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create sequence public.student_roll_seq start 100001;

-- Registration numbers are random (not sequential) so that roll + registration
-- cannot be enumerated for public result lookup.
create or replace function public.generate_registration_no() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v text;
begin
  loop
    v := to_char(now(), 'YY') || lpad(floor(random() * 100000000)::bigint::text, 8, '0');
    exit when not exists (select 1 from public.students s where s.registration_no = v);
  end loop;
  return v;
end $$;

create table public.students (
  id              uuid primary key default gen_random_uuid(),
  institute_id    uuid not null references public.institutes (id) on delete restrict,
  course_id       uuid not null references public.courses (id) on delete restrict,
  session_id      uuid not null references public.academic_sessions (id) on delete restrict,
  roll_no         text not null unique default nextval('public.student_roll_seq')::text
                    check (roll_no ~ '^[A-Z0-9-]{3,20}$'),
  registration_no text not null unique check (registration_no ~ '^[A-Z0-9-]{4,20}$'),
  name_en         text not null check (length(name_en) between 2 and 120),
  name_bn         text,
  father_name     text,
  mother_name     text,
  date_of_birth   date check (date_of_birth > '1900-01-01'),
  gender          text check (gender in ('male', 'female', 'other')),
  phone           text,
  email           text,
  address         text,
  national_id     text,   -- PRIVATE: NID / birth registration number
  photo_path      text,   -- PRIVATE storage object path
  status          public.student_status not null default 'active',
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index students_institute_idx on public.students (institute_id);
create index students_course_idx on public.students (course_id);
create index students_session_idx on public.students (session_id);
create index students_name_idx on public.students (lower(name_en));

create or replace function public.students_normalize() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.roll_no := upper(btrim(new.roll_no));
  if new.registration_no is null or btrim(new.registration_no) = '' then
    new.registration_no := public.generate_registration_no();
  end if;
  new.registration_no := upper(btrim(new.registration_no));
  return new;
end $$;
create trigger students_normalize before insert or update on public.students
  for each row execute function public.students_normalize();
create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger students_audit after insert or update or delete on public.students
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- Import batches (bulk uploads staged before commit)
-- ---------------------------------------------------------------------------
create table public.import_batches (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('results', 'students')),
  status          public.batch_status not null default 'validated',
  file_name       text not null,
  file_size       int,
  file_sha256     text,
  file_path       text,          -- original upload in private storage
  institute_id    uuid references public.institutes (id) on delete restrict,
  total_rows      int not null default 0,
  valid_rows      int not null default 0,
  error_rows      int not null default 0,
  errors          jsonb not null default '[]'::jsonb,
  payload         jsonb not null default '[]'::jsonb,   -- normalized rows awaiting commit
  summary         jsonb,
  notes           text,
  failure_reason  text,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  committed_at    timestamptz,
  committed_by    uuid references auth.users (id) on delete set null,
  published_at    timestamptz,
  published_by    uuid references auth.users (id) on delete set null,
  unpublished_at  timestamptz,
  rolled_back_at  timestamptz,
  rolled_back_by  uuid references auth.users (id) on delete set null
);
create index import_batches_created_idx on public.import_batches (created_at desc);

-- Audit batch lifecycle without copying the (potentially large) payload
create or replace function public.import_batches_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    values (
      auth.uid(),
      case when tg_op = 'INSERT' then 'INSERT' else 'STATUS' end,
      'import_batches',
      new.id::text,
      case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status) end,
      jsonb_build_object('status', new.status, 'kind', new.kind, 'file_name', new.file_name,
                         'total_rows', new.total_rows, 'error_rows', new.error_rows,
                         'failure_reason', new.failure_reason)
    );
  end if;
  return new;
end $$;
create trigger import_batches_audit after insert or update on public.import_batches
  for each row execute function public.import_batches_audit();

-- ---------------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------------
create table public.results (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams (id) on delete restrict,
  student_id      uuid not null references public.students (id) on delete restrict,
  institute_id    uuid not null references public.institutes (id) on delete restrict,
  theory_marks    numeric(6, 2) check (theory_marks >= 0),
  practical_marks numeric(6, 2) check (practical_marks >= 0),
  total_marks     numeric(6, 2),
  percentage      numeric(5, 2),
  grade           text,
  grade_point     numeric(3, 2),
  is_pass         boolean,
  remarks         text,
  status          public.result_status not null default 'draft',
  batch_id        uuid references public.import_batches (id) on delete set null,
  version         int not null default 1,
  published_at    timestamptz,
  published_by    uuid references auth.users (id) on delete set null,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (student_id, exam_id)
);
create index results_exam_idx on public.results (exam_id);
create index results_institute_idx on public.results (institute_id);
create index results_batch_idx on public.results (batch_id);
create index results_status_idx on public.results (status);

-- Derive tenant, validate marks, compute grade, and guard publication.
create or replace function public.results_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e   public.exams;
  s   public.students;
  pct numeric;
  marks_changed boolean;
begin
  select * into e from public.exams where id = new.exam_id;
  if not found then raise exception 'Exam not found'; end if;
  select * into s from public.students where id = new.student_id;
  if not found then raise exception 'Student not found'; end if;
  if s.course_id <> e.course_id then
    raise exception 'Student % is not enrolled in the course of exam %', s.roll_no, e.code;
  end if;

  new.institute_id := s.institute_id;

  if new.theory_marks is not null and new.theory_marks > e.theory_full_marks then
    raise exception 'Theory marks % exceed full marks % (roll %)', new.theory_marks, e.theory_full_marks, s.roll_no;
  end if;
  if new.practical_marks is not null and new.practical_marks > e.practical_full_marks then
    raise exception 'Practical marks % exceed full marks % (roll %)', new.practical_marks, e.practical_full_marks, s.roll_no;
  end if;

  new.total_marks := coalesce(new.theory_marks, 0) + coalesce(new.practical_marks, 0);
  pct := round(new.total_marks * 100 / (e.theory_full_marks + e.practical_full_marks), 2);
  new.percentage := pct;
  new.is_pass := new.total_marks >= e.pass_marks;
  if new.is_pass then
    select g.grade, g.grade_point into new.grade, new.grade_point
    from public.grade_rules g where g.min_percent <= pct order by g.min_percent desc limit 1;
  else
    new.grade := 'F';
    new.grade_point := 0;
  end if;

  if tg_op = 'INSERT' then
    -- Results can never be created in a published state (no auto-publish).
    if new.status not in ('draft', 'submitted') then
      raise exception 'New results must be created as draft or submitted';
    end if;
    new.version := 1;
    new.published_at := null;
    new.published_by := null;
    return new;
  end if;

  -- UPDATE
  new.updated_by := auth.uid();
  marks_changed := (old.theory_marks, old.practical_marks, old.remarks)
                   is distinct from (new.theory_marks, new.practical_marks, new.remarks);

  if new.status is distinct from old.status
     and (new.status in ('published', 'unpublished') or old.status in ('published', 'unpublished'))
     and not (public.can_publish() or public.is_backend()) then
    raise exception 'Only authorized central roles may publish or unpublish results';
  end if;

  if old.status in ('published', 'unpublished') and marks_changed then
    if not (public.can_publish() or public.is_backend()) then
      raise exception 'Only authorized central roles may correct published results';
    end if;
    if coalesce(current_setting('app.change_reason', true), '') = '' then
      raise exception 'A reason is required to correct a published result';
    end if;
  end if;

  if marks_changed then
    new.version := old.version + 1;
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
    new.published_by := auth.uid();
  end if;
  return new;
end $$;
create trigger results_before_write before insert or update on public.results
  for each row execute function public.results_before_write();
create trigger results_updated_at before update on public.results
  for each row execute function public.set_updated_at();
create trigger results_audit after insert or update or delete on public.results
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- Certificates (issued in Phase 3; table exists so verification is real)
-- ---------------------------------------------------------------------------
create table public.certificates (
  id             uuid primary key default gen_random_uuid(),
  certificate_no text not null unique,
  result_id      uuid not null unique references public.results (id) on delete restrict,
  student_id     uuid not null references public.students (id) on delete restrict,
  institute_id   uuid not null references public.institutes (id) on delete restrict,
  status         text not null default 'valid' check (status in ('valid', 'revoked')),
  issued_at      timestamptz not null default now(),
  issued_by      uuid references auth.users (id) on delete set null,
  revoked_at     timestamptz,
  revoked_by     uuid references auth.users (id) on delete set null,
  revoke_reason  text,
  version        int not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger certificates_updated_at before update on public.certificates
  for each row execute function public.set_updated_at();
create trigger certificates_audit after insert or update or delete on public.certificates
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------------
-- CMS
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id                   int primary key default 1 check (id = 1),
  org_name_en          text not null,
  org_name_bn          text,
  short_name           text,
  tagline_en           text,
  tagline_bn           text,
  logo_url             text,
  email                text,
  phone                text,
  address_en           text,
  address_bn           text,
  office_hours_en      text,
  office_hours_bn      text,
  map_embed_url        text,
  footer_text_en       text,
  footer_text_bn       text,
  disclaimer_en        text,
  disclaimer_bn        text,
  facebook_url         text,
  youtube_url          text,
  seo_title_en         text,
  seo_title_bn         text,
  seo_description_en   text,
  seo_description_bn   text,
  og_image_url         text,
  updated_at           timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
create trigger site_settings_audit after insert or update on public.site_settings
  for each row execute function public.audit_trigger();

create table public.pages (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  is_system          boolean not null default false,   -- built-in routes (cannot be deleted)
  title_en           text not null,
  title_bn           text,
  body_en            text,
  body_bn            text,
  seo_title_en       text,
  seo_title_bn       text,
  seo_description_en text,
  seo_description_bn text,
  og_image_url       text,
  is_published       boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger pages_updated_at before update on public.pages
  for each row execute function public.set_updated_at();
create trigger pages_audit after insert or update or delete on public.pages
  for each row execute function public.audit_trigger();

create table public.banners (
  id          uuid primary key default gen_random_uuid(),
  title_en    text not null,
  title_bn    text,
  subtitle_en text,
  subtitle_bn text,
  image_url   text,
  link_url    text,
  link_label_en text,
  link_label_bn text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();
create trigger banners_audit after insert or update or delete on public.banners
  for each row execute function public.audit_trigger();

create table public.menu_items (
  id         uuid primary key default gen_random_uuid(),
  location   text not null check (location in ('header', 'footer')),
  label_en   text not null,
  label_bn   text,
  href       text not null check (href ~ '^(/|https?://)'),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger menu_items_audit after insert or update or delete on public.menu_items
  for each row execute function public.audit_trigger();

create table public.notices (
  id             uuid primary key default gen_random_uuid(),
  title_en       text not null,
  title_bn       text,
  body_en        text,
  body_bn        text,
  attachment_url text,
  is_pinned      boolean not null default false,
  is_published   boolean not null default true,
  published_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index notices_published_idx on public.notices (published_at desc);
create trigger notices_updated_at before update on public.notices
  for each row execute function public.set_updated_at();
create trigger notices_audit after insert or update or delete on public.notices
  for each row execute function public.audit_trigger();

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 2 and 120),
  email      text check (email is null or length(email) <= 200),
  phone      text check (phone is null or length(phone) <= 30),
  subject    text check (subject is null or length(subject) <= 200),
  message    text not null check (length(message) between 5 and 5000),
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Rate limiting for public lookups (accessed only via SECURITY DEFINER code)
create table public.lookup_attempts (
  id         bigint generated always as identity primary key,
  client_key text not null,
  kind       text not null,
  created_at timestamptz not null default now()
);
create index lookup_attempts_idx on public.lookup_attempts (client_key, kind, created_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.institutes        enable row level security;
alter table public.profiles          enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.courses           enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.exams             enable row level security;
alter table public.grade_rules       enable row level security;
alter table public.students          enable row level security;
alter table public.import_batches    enable row level security;
alter table public.results           enable row level security;
alter table public.certificates      enable row level security;
alter table public.site_settings     enable row level security;
alter table public.pages             enable row level security;
alter table public.banners           enable row level security;
alter table public.menu_items        enable row level security;
alter table public.notices           enable row level security;
alter table public.contact_messages  enable row level security;
alter table public.lookup_attempts   enable row level security;

-- Institutes: central sees all; tenant sees own. Public listing via function.
create policy institutes_select on public.institutes for select to authenticated
  using (public.is_central() or id = public.current_institute_id());
create policy institutes_insert on public.institutes for insert to authenticated
  with check (public.is_central());
create policy institutes_update on public.institutes for update to authenticated
  using (public.is_central()) with check (public.is_central());
create policy institutes_delete on public.institutes for delete to authenticated
  using (public.has_role(array['super_admin']::public.app_role[]));

-- Profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_central()
    or (institute_id is not null and institute_id = public.current_institute_id()
        and public.has_role(array['institute_admin']::public.app_role[]))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (public.has_role(array['super_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin']::public.app_role[]));

-- Audit logs: read-only for senior central roles
create policy audit_select on public.audit_logs for select to authenticated
  using (public.has_role(array['super_admin', 'central_admin']::public.app_role[]));

-- Reference data
create policy courses_select_public on public.courses for select to anon
  using (is_published);
create policy courses_select_auth on public.courses for select to authenticated
  using (true);
create policy courses_write on public.courses for all to authenticated
  using (public.is_central()) with check (public.is_central());

create policy sessions_select on public.academic_sessions for select to authenticated using (true);
create policy sessions_write on public.academic_sessions for all to authenticated
  using (public.is_central()) with check (public.is_central());

create policy exams_select on public.exams for select to authenticated using (true);
create policy exams_write on public.exams for all to authenticated
  using (public.is_central()) with check (public.is_central());

create policy grade_rules_select on public.grade_rules for select to authenticated using (true);
create policy grade_rules_write on public.grade_rules for all to authenticated
  using (public.can_publish()) with check (public.can_publish());

-- Students: tenant isolation
create policy students_select on public.students for select to authenticated
  using (public.is_central() or institute_id = public.current_institute_id());
create policy students_insert on public.students for insert to authenticated
  with check (public.is_central() or institute_id = public.current_institute_id());
create policy students_update on public.students for update to authenticated
  using (public.is_central() or institute_id = public.current_institute_id())
  with check (public.is_central() or institute_id = public.current_institute_id());
create policy students_delete on public.students for delete to authenticated
  using (
    public.has_role(array['super_admin', 'central_admin']::public.app_role[])
    or (institute_id = public.current_institute_id()
        and public.has_role(array['institute_admin']::public.app_role[]))
  );

-- Import batches
create policy batches_select on public.import_batches for select to authenticated
  using (public.is_central() or institute_id = public.current_institute_id());
create policy batches_insert on public.import_batches for insert to authenticated
  with check (public.is_central() or (institute_id is not null and institute_id = public.current_institute_id()));
create policy batches_update on public.import_batches for update to authenticated
  using (public.is_central() or (institute_id = public.current_institute_id() and status in ('validated', 'committed', 'failed')))
  with check (public.is_central() or (institute_id = public.current_institute_id() and status in ('validated', 'committed', 'failed', 'rolled_back')));

-- Results: tenants may only touch draft/submitted rows of their own institute
create policy results_select on public.results for select to authenticated
  using (public.is_central() or institute_id = public.current_institute_id());
create policy results_insert on public.results for insert to authenticated
  with check (public.is_central() or institute_id = public.current_institute_id());
create policy results_update on public.results for update to authenticated
  using (public.is_central() or (institute_id = public.current_institute_id() and status in ('draft', 'submitted')))
  with check (public.is_central() or (institute_id = public.current_institute_id() and status in ('draft', 'submitted')));
create policy results_delete on public.results for delete to authenticated
  using (
    (public.is_central() and status <> 'published')
    or (institute_id = public.current_institute_id() and status in ('draft', 'submitted'))
  );

-- Certificates: central manage; tenant read own
create policy certificates_select on public.certificates for select to authenticated
  using (public.is_central() or institute_id = public.current_institute_id());
create policy certificates_write on public.certificates for all to authenticated
  using (public.can_publish()) with check (public.can_publish());

-- CMS: public read of published content, editors write
create policy settings_select on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for update to authenticated
  using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy pages_select_public on public.pages for select to anon using (is_published);
create policy pages_select_auth on public.pages for select to authenticated
  using (is_published or public.is_cms_editor());
create policy pages_write on public.pages for all to authenticated
  using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy banners_select_public on public.banners for select to anon using (is_active);
create policy banners_select_auth on public.banners for select to authenticated
  using (is_active or public.is_cms_editor());
create policy banners_write on public.banners for all to authenticated
  using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy menu_select_public on public.menu_items for select to anon using (is_active);
create policy menu_select_auth on public.menu_items for select to authenticated
  using (is_active or public.is_cms_editor());
create policy menu_write on public.menu_items for all to authenticated
  using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy notices_select_public on public.notices for select to anon
  using (is_published and published_at <= now());
create policy notices_select_auth on public.notices for select to authenticated
  using ((is_published and published_at <= now()) or public.is_central());
create policy notices_write on public.notices for all to authenticated
  using (public.is_cms_editor()) with check (public.is_cms_editor());

create policy contact_insert on public.contact_messages for insert to anon, authenticated
  with check (is_read = false);
create policy contact_select on public.contact_messages for select to authenticated
  using (public.is_central());
create policy contact_update on public.contact_messages for update to authenticated
  using (public.is_central()) with check (public.is_central());
create policy contact_delete on public.contact_messages for delete to authenticated
  using (public.is_cms_editor());

-- lookup_attempts: no policies => no direct access for anon/authenticated

-- =============================================================================
-- Result batch operations (transactional; run with caller's privileges so RLS
-- and the publication guard apply)
-- =============================================================================

-- Commit a validated batch: insert every staged row as DRAFT in one transaction.
create or replace function public.commit_result_batch(p_batch_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  b public.import_batches;
  n int;
begin
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.kind <> 'results' then raise exception 'Not a results batch'; end if;
  if b.status <> 'validated' then
    raise exception 'Batch cannot be committed from status %', b.status;
  end if;
  if b.error_rows > 0 then
    raise exception 'Batch has % row(s) with validation errors; fix the file and upload again', b.error_rows;
  end if;

  begin
    insert into public.results (exam_id, student_id, theory_marks, practical_marks, remarks, status, batch_id)
    select (r ->> 'exam_id')::uuid,
           (r ->> 'student_id')::uuid,
           nullif(r ->> 'theory_marks', '')::numeric,
           nullif(r ->> 'practical_marks', '')::numeric,
           nullif(r ->> 'remarks', ''),
           case when public.is_central() then 'draft' else 'submitted' end::public.result_status,
           b.id
    from jsonb_array_elements(b.payload) as r;
    get diagnostics n = row_count;
  exception when others then
    -- Nothing was inserted (statement rolled back); record the failure.
    update public.import_batches
       set status = 'failed', failure_reason = left(sqlerrm, 1000)
     where id = b.id;
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  update public.import_batches
     set status = 'committed', committed_at = now(), committed_by = auth.uid(), failure_reason = null
   where id = b.id;
  return jsonb_build_object('ok', true, 'inserted', n);
end $$;

-- Publish / unpublish all results of a batch (central publishers only).
create or replace function public.set_batch_publication(p_batch_id uuid, p_publish boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  b public.import_batches;
  n int;
begin
  if not public.can_publish() then
    raise exception 'Only authorized central roles may publish or unpublish results';
  end if;
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.kind <> 'results' then raise exception 'Not a results batch'; end if;

  if p_publish then
    if b.status not in ('committed', 'unpublished') then
      raise exception 'Batch cannot be published from status %', b.status;
    end if;
    update public.results set status = 'published'
     where batch_id = b.id and status in ('draft', 'submitted', 'unpublished');
    get diagnostics n = row_count;
    update public.import_batches
       set status = 'published', published_at = now(), published_by = auth.uid()
     where id = b.id;
  else
    if b.status <> 'published' then
      raise exception 'Batch cannot be unpublished from status %', b.status;
    end if;
    update public.results set status = 'unpublished'
     where batch_id = b.id and status = 'published';
    get diagnostics n = row_count;
    update public.import_batches
       set status = 'unpublished', unpublished_at = now()
     where id = b.id;
  end if;
  return jsonb_build_object('ok', true, 'affected', n);
end $$;

-- Roll back a committed (not published) batch: remove its results.
create or replace function public.rollback_result_batch(p_batch_id uuid, p_reason text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  b public.import_batches;
  n int;
begin
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status not in ('committed', 'unpublished') then
    raise exception 'Batch cannot be rolled back from status %', b.status;
  end if;
  if exists (select 1 from public.results where batch_id = b.id and status = 'published') then
    raise exception 'Unpublish the batch before rolling it back';
  end if;
  perform set_config('app.change_reason', p_reason, true);
  delete from public.results where batch_id = b.id;
  get diagnostics n = row_count;
  update public.import_batches
     set status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid(),
         notes = coalesce(notes || E'\n', '') || 'Rollback: ' || p_reason
   where id = b.id;
  return jsonb_build_object('ok', true, 'deleted', n);
end $$;

-- Publish / unpublish an arbitrary selection of results.
create or replace function public.set_results_publication(p_ids uuid[], p_publish boolean) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  if not public.can_publish() then
    raise exception 'Only authorized central roles may publish or unpublish results';
  end if;
  if p_publish then
    update public.results set status = 'published'
     where id = any (p_ids) and status in ('draft', 'submitted', 'unpublished');
  else
    update public.results set status = 'unpublished'
     where id = any (p_ids) and status = 'published';
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'affected', n);
end $$;

-- Edit marks; a reason is mandatory (and enforced) for published results.
create or replace function public.correct_result(
  p_id uuid, p_theory numeric, p_practical numeric, p_remarks text, p_reason text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.results;
begin
  perform set_config('app.change_reason', coalesce(p_reason, ''), true);
  update public.results
     set theory_marks = p_theory, practical_marks = p_practical, remarks = nullif(btrim(p_remarks), '')
   where id = p_id
  returning * into r;
  if not found then raise exception 'Result not found or not editable'; end if;
  return jsonb_build_object('ok', true, 'version', r.version, 'grade', r.grade);
end $$;

-- =============================================================================
-- Public read functions (return ONLY public fields)
-- =============================================================================

-- Verified (approved) institutes directory
create or replace function public.public_institutes(p_search text default null)
returns table (code text, name_en text, name_bn text, district text, address text, phone text, established_year int)
language sql stable security definer set search_path = '' as $$
  select i.code, i.name_en, i.name_bn, i.district, i.address, i.phone, i.established_year
  from public.institutes i
  where i.status = 'approved'
    and (p_search is null or p_search = ''
         or i.name_en ilike '%' || p_search || '%'
         or i.name_bn ilike '%' || p_search || '%'
         or i.code ilike '%' || p_search || '%'
         or i.district ilike '%' || p_search || '%')
  order by i.name_en;
$$;

-- Aggregate counts for the public home page
create or replace function public.public_stats()
returns table (institutes bigint, students bigint, courses bigint, certified bigint)
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.institutes where status = 'approved'),
         (select count(*) from public.students),
         (select count(*) from public.courses where is_published),
         (select count(*) from public.results where status = 'published' and is_pass);
$$;

-- Rate-limit helper: returns false when the caller exceeded the limit.
create or replace function public.check_rate_limit(p_client_key text, p_kind text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  delete from public.lookup_attempts where created_at < now() - interval '1 day';
  select count(*) into c from public.lookup_attempts
   where client_key = p_client_key and kind = p_kind and created_at > now() - p_window;
  if c >= p_max then return false; end if;
  insert into public.lookup_attempts (client_key, kind) values (p_client_key, p_kind);
  return true;
end $$;

-- Public result lookup: roll number + registration number, published only.
create or replace function public.public_result_lookup(p_roll text, p_registration text)
returns table (
  student_name text, student_name_bn text, roll_no text, registration_no text,
  institute_name text, institute_code text, course_title text, course_code text,
  session_name text, exam_name text, exam_code text,
  theory_marks numeric, practical_marks numeric, total_marks numeric, full_marks numeric,
  percentage numeric, grade text, grade_point numeric, is_pass boolean, published_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select s.name_en, s.name_bn, s.roll_no, s.registration_no,
         i.name_en, i.code, c.title_en, c.code,
         ses.name, e.name, e.code,
         r.theory_marks, r.practical_marks, r.total_marks, e.theory_full_marks + e.practical_full_marks,
         r.percentage, r.grade, r.grade_point, r.is_pass, r.published_at
  from public.students s
  join public.results r on r.student_id = s.id and r.status = 'published'
  join public.exams e on e.id = r.exam_id
  join public.courses c on c.id = e.course_id
  join public.academic_sessions ses on ses.id = e.session_id
  join public.institutes i on i.id = s.institute_id
  where s.roll_no = upper(btrim(p_roll))
    and s.registration_no = upper(btrim(p_registration))
  order by e.exam_date desc nulls last, r.published_at desc;
$$;

-- Public certificate verification
create or replace function public.public_verify_certificate(p_certificate_no text)
returns table (
  certificate_no text, status text, issued_at timestamptz, revoked_at timestamptz,
  student_name text, roll_no text, institute_name text, course_title text,
  session_name text, grade text, grade_point numeric, result_status text
)
language sql stable security definer set search_path = '' as $$
  select ce.certificate_no, ce.status, ce.issued_at, ce.revoked_at,
         s.name_en, s.roll_no, i.name_en, c.title_en,
         ses.name, r.grade, r.grade_point, r.status::text
  from public.certificates ce
  join public.results r on r.id = ce.result_id
  join public.students s on s.id = ce.student_id
  join public.institutes i on i.id = ce.institute_id
  join public.exams e on e.id = r.exam_id
  join public.courses c on c.id = e.course_id
  join public.academic_sessions ses on ses.id = e.session_id
  where ce.certificate_no = upper(btrim(p_certificate_no));
$$;

-- =============================================================================
-- Function privileges: deny by default, then grant explicitly
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.has_role(public.app_role[]) to authenticated;
grant execute on function public.is_central()                to authenticated;
grant execute on function public.can_publish()               to authenticated;
grant execute on function public.is_cms_editor()             to authenticated;
grant execute on function public.current_institute_id()      to authenticated;
grant execute on function public.is_backend()                to authenticated;
grant execute on function public.generate_registration_no()  to authenticated;
grant execute on function public.log_event(text, text, text, jsonb, text) to authenticated;
grant execute on function public.commit_result_batch(uuid)                 to authenticated;
grant execute on function public.set_batch_publication(uuid, boolean)      to authenticated;
grant execute on function public.rollback_result_batch(uuid, text)         to authenticated;
grant execute on function public.set_results_publication(uuid[], boolean)  to authenticated;
grant execute on function public.correct_result(uuid, numeric, numeric, text, text) to authenticated;

-- Public directory & stats are harmless projections
grant execute on function public.public_institutes(text) to anon, authenticated;
grant execute on function public.public_stats()          to anon, authenticated;

-- Result lookup / certificate verification / rate limiting are called only by
-- the Next.js server (service role) so that per-client rate limits apply.
grant execute on function public.check_rate_limit(text, text, int, interval) to service_role;
grant execute on function public.public_result_lookup(text, text)           to service_role;
grant execute on function public.public_verify_certificate(text)            to service_role;

-- Trigger functions are invoked by the database itself; default privileges in
-- Supabase grant new functions to anon/authenticated, so revoke for the future.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- =============================================================================
-- Storage buckets
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 5242880,
   array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf']),
  ('private-documents', 'private-documents', false, 10485760,
   array['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "public-media editors insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and public.is_cms_editor());
create policy "public-media editors update" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and public.is_cms_editor());
create policy "public-media editors delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and public.is_cms_editor());
create policy "public-media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'public-media');

-- private-documents layout: imports/<batch>/..., institutes/<institute_id>/...
create policy "private central read" on storage.objects for select to authenticated
  using (bucket_id = 'private-documents' and public.is_central());
create policy "private central write" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-documents' and public.is_central());
create policy "private central delete" on storage.objects for delete to authenticated
  using (bucket_id = 'private-documents' and public.has_role(array['super_admin', 'central_admin']::public.app_role[]));
create policy "private tenant read" on storage.objects for select to authenticated
  using (bucket_id = 'private-documents'
         and (storage.foldername(name))[1] = 'institutes'
         and (storage.foldername(name))[2] = public.current_institute_id()::text);
create policy "private tenant write" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-documents'
              and (storage.foldername(name))[1] = 'institutes'
              and (storage.foldername(name))[2] = public.current_institute_id()::text);
