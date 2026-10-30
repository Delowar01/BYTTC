-- Academic records upgrade (batch 1): richer student/institute data, Viva
-- marks, versioned grading scales, displayed publication dates and audited
-- corrections. Additive only: existing rows keep their values.

-- ---------------------------------------------------------------------------
-- Students & institutes
-- ---------------------------------------------------------------------------
alter table public.students
  add column passport_no text check (passport_no is null or passport_no ~ '^[A-Z0-9]{5,20}$'),  -- PRIVATE
  add column thana text check (thana is null or length(thana) <= 80),
  add column district text check (district is null or length(district) <= 80),
  add column passing_year int check (passing_year between 1950 and 2100),
  -- Existing students keep an unknown (blank) date; new students default to today (below).
  add column enrollment_date date,
  -- Historical exception to the course's standard duration (audited like every student change)
  add column course_duration_override text check (course_duration_override is null or length(course_duration_override) <= 40);
alter table public.students alter column enrollment_date set default current_date;
create unique index students_passport_unique on public.students (passport_no) where passport_no is not null;

create or replace function public.students_normalize() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.roll_no := upper(btrim(new.roll_no));
  if new.registration_no is null or btrim(new.registration_no) = '' then
    new.registration_no := public.generate_registration_no();
  end if;
  new.registration_no := upper(btrim(new.registration_no));
  new.passport_no := nullif(upper(regexp_replace(coalesce(new.passport_no, ''), '\s', '', 'g')), '');
  return new;
end $$;

alter table public.institutes
  add column registration_no text check (registration_no is null or length(registration_no) <= 60);

alter table public.site_settings
  add column org_registration_no text check (org_registration_no is null or length(org_registration_no) <= 60);

-- Passport numbers join national IDs as never-logged personal identifiers.
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  redact constant text[] := array['national_id', 'passport_no'];
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

-- ---------------------------------------------------------------------------
-- Versioned grading scales. A version is immutable once created; "editing"
-- creates the next version. Each result keeps the version it was graded with.
-- ---------------------------------------------------------------------------
create or replace function public.valid_grade_rules(rules jsonb, max_point numeric) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(rules) = 'array'
     and jsonb_array_length(rules) between 2 and 20
     and not exists (
       select 1 from jsonb_array_elements(rules) r
       where jsonb_typeof(r -> 'min_percent') <> 'number' or jsonb_typeof(r -> 'point') <> 'number'
          or coalesce(btrim(r ->> 'grade'), '') = ''
          or (r ->> 'min_percent')::numeric not between 0 and 100
          or (r ->> 'point')::numeric not between 0 and max_point)
     and exists (select 1 from jsonb_array_elements(rules) r where (r ->> 'min_percent')::numeric = 0);
$$;

create table public.grade_scales (
  id         uuid primary key default gen_random_uuid(),
  code       text not null check (code ~ '^[A-Z0-9-]{2,20}$'),
  version    int not null default 1,
  name       text not null,
  max_point  numeric(4, 2) not null check (max_point > 0 and max_point <= 10),
  rules      jsonb not null,
  is_current boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (code, version),
  check (public.valid_grade_rules(rules, max_point))
);
create unique index grade_scales_one_current on public.grade_scales (code) where is_current;
alter table public.grade_scales enable row level security;
create policy grade_scales_select on public.grade_scales for select to authenticated using (true);
create trigger grade_scales_audit after insert or update on public.grade_scales
  for each row execute function public.audit_trigger();

-- 5.00 scale from the rules currently in use; 4.00 scale (80% = 4.00).
insert into public.grade_scales (code, version, name, max_point, rules)
select 'GPA5', 1, 'GPA 5.00 scale', 5,
       jsonb_agg(jsonb_build_object('min_percent', min_percent, 'grade', grade, 'point', grade_point) order by min_percent desc)
from public.grade_rules;
insert into public.grade_scales (code, version, name, max_point, rules) values
('GPA4', 1, 'CGPA 4.00 scale', 4, '[
  {"min_percent": 80, "grade": "A+", "point": 4.00}, {"min_percent": 75, "grade": "A", "point": 3.75},
  {"min_percent": 70, "grade": "A-", "point": 3.50}, {"min_percent": 65, "grade": "B+", "point": 3.25},
  {"min_percent": 60, "grade": "B", "point": 3.00}, {"min_percent": 55, "grade": "B-", "point": 2.75},
  {"min_percent": 50, "grade": "C+", "point": 2.50}, {"min_percent": 45, "grade": "C", "point": 2.25},
  {"min_percent": 40, "grade": "D", "point": 2.00}, {"min_percent": 0, "grade": "F", "point": 0.00}]');

-- Publishers save a scale: the current version is retired and a new one created.
create or replace function public.save_grade_scale(p_code text, p_name text, p_max_point numeric, p_rules jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may change grading scales'; end if;
  select coalesce(max(version), 0) + 1 into v from public.grade_scales where code = upper(p_code);
  update public.grade_scales set is_current = false where code = upper(p_code) and is_current;
  insert into public.grade_scales (code, version, name, max_point, rules)
  values (upper(p_code), v, p_name, p_max_point,
          (select jsonb_agg(r order by (r ->> 'min_percent')::numeric desc) from jsonb_array_elements(p_rules) r));
  return jsonb_build_object('ok', true, 'version', v);
end $$;

-- ---------------------------------------------------------------------------
-- Exams: optional Viva component and grading scale
-- ---------------------------------------------------------------------------
alter table public.exams
  add column viva_full_marks numeric(6, 2) not null default 0 check (viva_full_marks >= 0),
  add column grade_scale_code text not null default 'GPA5';
alter table public.exams drop constraint exams_check, drop constraint exams_check1;
alter table public.exams
  add constraint exams_full_marks_positive check (theory_full_marks + practical_full_marks + viva_full_marks > 0),
  add constraint exams_pass_within_full check (pass_marks <= theory_full_marks + practical_full_marks + viva_full_marks);

-- ---------------------------------------------------------------------------
-- Results: Viva, full marks, grading version, overrides and publication dates
-- ---------------------------------------------------------------------------
alter table public.results
  add column viva_marks numeric(6, 2) check (viva_marks >= 0),
  add column full_marks numeric(7, 2),
  add column grade_scale_id uuid references public.grade_scales (id) on delete restrict,
  add column grade_override text check (grade_override is null or length(grade_override) <= 5),
  add column grade_point_override numeric(4, 2) check (grade_point_override >= 0),
  -- System-recorded first publication: never rewritten.
  add column first_published_at timestamptz,
  -- Date printed on results/documents: editable by publishers with a reason.
  add column display_published_on date;
alter table public.results alter column grade_point type numeric(4, 2);

-- Backfill derived columns of existing results. This is schema maintenance,
-- not an academic change: user triggers are switched off for these statements
-- (only the table owner can do this), so the role guards — which do not
-- recognize the migration login, e.g. the CLI's temporary login role — cannot
-- block published results, and updated_at/version stay untouched. One audit
-- entry records the backfill.
alter table public.results disable trigger user;
update public.results r
   set full_marks = e.theory_full_marks + e.practical_full_marks + e.viva_full_marks,
       grade_scale_id = (select id from public.grade_scales where code = 'GPA5' and version = 1),
       first_published_at = r.published_at,
       display_published_on = (r.published_at at time zone 'Asia/Dhaka')::date
  from public.exams e
 where e.id = r.exam_id;
alter table public.results enable trigger user;
insert into public.audit_logs (action, table_name, record_id, new_data, reason)
select 'migration.backfill', 'results', '20261031000100', jsonb_build_object('rows', count(*)),
       'Schema upgrade: full marks, grading scale v1, first publication time, displayed publication date'
from public.results;

alter table public.certificates add column needs_reissue boolean not null default false;

create or replace function public.results_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  e        public.exams;
  s        public.students;
  scale    public.grade_scales;
  rule     jsonb;
  pct      numeric;
  changed  boolean;
  override_changed boolean;
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
    raise exception 'Written/theory marks % exceed full marks % (roll %)', new.theory_marks, e.theory_full_marks, s.roll_no;
  end if;
  if new.practical_marks is not null and new.practical_marks > e.practical_full_marks then
    raise exception 'Practical marks % exceed full marks % (roll %)', new.practical_marks, e.practical_full_marks, s.roll_no;
  end if;
  if new.viva_marks is not null and new.viva_marks > e.viva_full_marks then
    raise exception 'Viva marks % exceed full marks % (roll %)', new.viva_marks, e.viva_full_marks, s.roll_no;
  end if;

  new.full_marks := e.theory_full_marks + e.practical_full_marks + e.viva_full_marks;
  new.total_marks := coalesce(new.theory_marks, 0) + coalesce(new.practical_marks, 0) + coalesce(new.viva_marks, 0);
  pct := round(new.total_marks * 100 / new.full_marks, 2);
  new.percentage := pct;
  new.is_pass := new.total_marks >= e.pass_marks;

  -- A result keeps the scale version it was first graded with.
  if tg_op = 'UPDATE' and old.grade_scale_id is not null and old.exam_id = new.exam_id then
    new.grade_scale_id := old.grade_scale_id;
  else
    select id into new.grade_scale_id from public.grade_scales where code = e.grade_scale_code and is_current;
    if not found then raise exception 'Grading scale % does not exist', e.grade_scale_code; end if;
  end if;
  select * into scale from public.grade_scales where id = new.grade_scale_id;
  if new.is_pass then
    select r into rule from jsonb_array_elements(scale.rules) r
     where (r ->> 'min_percent')::numeric <= pct order by (r ->> 'min_percent')::numeric desc limit 1;
  else
    select r into rule from jsonb_array_elements(scale.rules) r order by (r ->> 'min_percent')::numeric limit 1;
  end if;
  new.grade := rule ->> 'grade';
  new.grade_point := (rule ->> 'point')::numeric;

  -- Manual grade overrides: publishers only, with a reason, clearly recorded.
  override_changed := case when tg_op = 'INSERT' then new.grade_override is not null
                           else (old.grade_override, old.grade_point_override) is distinct from (new.grade_override, new.grade_point_override) end;
  if override_changed then
    if not (public.can_publish() or public.is_backend()) then
      raise exception 'Only authorized central roles may override a grade';
    end if;
    if coalesce(current_setting('app.change_reason', true), '') = '' then
      raise exception 'A reason is required to override a grade';
    end if;
    if new.grade_point_override is not null and new.grade_point_override > scale.max_point then
      raise exception 'Grade point override exceeds the scale maximum %', scale.max_point;
    end if;
  end if;
  if new.grade_override is not null then
    new.grade := new.grade_override;
    new.grade_point := coalesce(new.grade_point_override, new.grade_point);
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'New results must be created as draft or submitted';
    end if;
    new.version := 1;
    new.published_at := null;
    new.published_by := null;
    new.first_published_at := null;
    return new;
  end if;

  -- UPDATE
  new.updated_by := auth.uid();
  new.first_published_at := old.first_published_at;  -- immutable history
  changed := (old.theory_marks, old.practical_marks, old.viva_marks, old.remarks, old.display_published_on,
              old.grade_override, old.grade_point_override)
             is distinct from (new.theory_marks, new.practical_marks, new.viva_marks, new.remarks, new.display_published_on,
                               new.grade_override, new.grade_point_override);

  if new.status is distinct from old.status
     and (new.status in ('published', 'unpublished') or old.status in ('published', 'unpublished'))
     and not (public.can_publish() or public.is_backend()) then
    raise exception 'Only authorized central roles may publish or unpublish results';
  end if;

  if old.status in ('published', 'unpublished') and changed then
    if not (public.can_publish() or public.is_backend()) then
      raise exception 'Only authorized central roles may correct published results';
    end if;
    if coalesce(current_setting('app.change_reason', true), '') = '' then
      raise exception 'A reason is required to correct a published result';
    end if;
  end if;

  if changed then
    new.version := old.version + 1;
    -- Issued certificates keep their snapshot; flag them for reissue.
    update public.certificates set needs_reissue = true where result_id = new.id and status = 'valid';
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
    new.published_by := auth.uid();
    if old.first_published_at is null then
      new.first_published_at := now();
    end if;
    if new.display_published_on is null then
      new.display_published_on := (now() at time zone 'Asia/Dhaka')::date;
    end if;
  end if;
  return new;
end $$;

-- Single-result corrections (marks, Viva, remarks, displayed date, override).
create or replace function public.correct_result_v2(
  p_id uuid, p_theory numeric, p_practical numeric, p_viva numeric, p_remarks text,
  p_display_published_on date, p_grade_override text, p_grade_point_override numeric, p_reason text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.results;
begin
  perform set_config('app.change_reason', coalesce(btrim(p_reason), ''), true);
  update public.results
     set theory_marks = p_theory, practical_marks = p_practical, viva_marks = p_viva,
         remarks = nullif(btrim(p_remarks), ''), display_published_on = p_display_published_on,
         grade_override = nullif(btrim(p_grade_override), ''), grade_point_override = p_grade_point_override
   where id = p_id
  returning * into r;
  if not found then raise exception 'Result not found or not editable'; end if;
  return jsonb_build_object('ok', true, 'version', r.version, 'grade', r.grade);
end $$;

-- Batch commits now carry Viva marks.
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
    insert into public.results (exam_id, student_id, theory_marks, practical_marks, viva_marks, remarks, status, batch_id)
    select (r ->> 'exam_id')::uuid,
           (r ->> 'student_id')::uuid,
           nullif(r ->> 'theory_marks', '')::numeric,
           nullif(r ->> 'practical_marks', '')::numeric,
           nullif(r ->> 'viva_marks', '')::numeric,
           nullif(r ->> 'remarks', ''),
           case when public.is_central() then 'draft' else 'submitted' end::public.result_status,
           b.id
    from jsonb_array_elements(b.payload) as r;
    get diagnostics n = row_count;
  exception when others then
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

grant execute on function public.save_grade_scale(text, text, numeric, jsonb) to authenticated;
grant execute on function public.correct_result_v2(uuid, numeric, numeric, numeric, text, date, text, numeric, text) to authenticated;
grant execute on function public.valid_grade_rules(jsonb, numeric) to authenticated;

-- Student imports carry the new optional fields.
create or replace function public.commit_student_batch(p_batch_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  b public.import_batches;
  n int;
begin
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.kind <> 'students' then raise exception 'Not a students batch'; end if;
  if b.status <> 'validated' then
    raise exception 'Batch cannot be committed from status %', b.status;
  end if;
  if b.error_rows > 0 then
    raise exception 'Batch has % row(s) with validation errors; fix the file and upload again', b.error_rows;
  end if;

  begin
    insert into public.students (
      institute_id, course_id, session_id, roll_no, registration_no, name_en, name_bn,
      father_name, mother_name, date_of_birth, gender, phone, email, address,
      thana, district, passport_no, passing_year
    )
    select x.institute_id, x.course_id, x.session_id,
           coalesce(nullif(x.roll_no, ''), nextval('public.student_roll_seq')::text),
           coalesce(x.registration_no, ''),
           x.name_en, x.name_bn, x.father_name, x.mother_name, x.date_of_birth, x.gender,
           x.phone, x.email, x.address, x.thana, x.district, x.passport_no, x.passing_year
    from jsonb_to_recordset(b.payload) as x (
      institute_id uuid, course_id uuid, session_id uuid, roll_no text, registration_no text,
      name_en text, name_bn text, father_name text, mother_name text, date_of_birth date,
      gender text, phone text, email text, address text, thana text, district text,
      passport_no text, passing_year int
    );
    get diagnostics n = row_count;
  exception when others then
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
