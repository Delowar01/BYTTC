-- Phase 2: institute applications, course assignments, result submission.

-- ---------------------------------------------------------------------------
-- Online applications are stored as pending institutes with applicant data.
-- ---------------------------------------------------------------------------
alter table public.institutes
  add column applicant_name  text,
  add column applicant_email text,
  add column applicant_phone text,
  add column application_note text,
  add column requested_courses text[] not null default '{}', -- course codes
  add column documents       text[] not null default '{}',  -- private storage paths
  add column applied_at      timestamptz;

-- ---------------------------------------------------------------------------
-- Course assignments: which courses each institute may enrol students in.
-- ---------------------------------------------------------------------------
create table public.institute_courses (
  institute_id uuid not null references public.institutes (id) on delete cascade,
  course_id    uuid not null references public.courses (id) on delete restrict,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (institute_id, course_id)
);
create index institute_courses_course_idx on public.institute_courses (course_id);
alter table public.institute_courses enable row level security;

create policy institute_courses_select on public.institute_courses for select to authenticated
  using (public.is_central() or institute_id = public.current_institute_id());
create policy institute_courses_write on public.institute_courses for all to authenticated
  using (public.can_publish()) with check (public.can_publish());

-- Audit (composite key: record the pair)
create or replace function public.institute_courses_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.institute_courses;
begin
  r := coalesce(new, old);
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
  values (auth.uid(), tg_op, 'institute_courses', r.institute_id::text,
          jsonb_build_object('institute_id', r.institute_id, 'course_id', r.course_id));
  return r;
end $$;
create trigger institute_courses_audit after insert or delete on public.institute_courses
  for each row execute function public.institute_courses_audit();

-- Backfill from existing enrolments so current data stays valid.
insert into public.institute_courses (institute_id, course_id, assigned_by)
select distinct institute_id, course_id, null::uuid from public.students
on conflict do nothing;

-- A student may only be enrolled in a course assigned to their institute.
create or replace function public.students_check_course() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or new.course_id is distinct from old.course_id or new.institute_id is distinct from old.institute_id)
     and not exists (select 1 from public.institute_courses ic
                     where ic.institute_id = new.institute_id and ic.course_id = new.course_id) then
    raise exception 'Course is not assigned to this institute';
  end if;
  return new;
end $$;
create trigger students_check_course before insert or update on public.students
  for each row execute function public.students_check_course();

-- ---------------------------------------------------------------------------
-- Institute submission of draft results for central review.
-- ---------------------------------------------------------------------------
create or replace function public.submit_results(p_exam_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  update public.results set status = 'submitted'
   where exam_id = p_exam_id and status = 'draft'
     and (public.is_central() or institute_id = public.current_institute_id());
  get diagnostics n = row_count;
  perform public.log_event('results.submit', 'exams', p_exam_id::text, jsonb_build_object('count', n));
  return jsonb_build_object('ok', true, 'submitted', n);
end $$;

-- Tenants may only create/edit drafts and submissions, never other statuses
-- (the publication guard already blocks published/unpublished).
create or replace function public.results_tenant_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not public.is_central() and not public.is_backend() and new.status not in ('draft', 'submitted') then
    raise exception 'Institute users can only save draft or submitted results';
  end if;
  return new;
end $$;
create trigger results_tenant_status before insert or update on public.results
  for each row execute function public.results_tenant_status();

grant execute on function public.submit_results(uuid) to authenticated;

insert into public.menu_items (location, label_en, label_bn, href, sort_order)
values ('footer', 'Apply for affiliation', 'অধিভুক্তির আবেদন', '/apply', 40);
