-- Public results upgrade (batch 2): passport-based lookups, privacy-controlled
-- personal details, and opaque verification codes for result sheets.

-- Which personal details appear on PUBLIC result pages/sheets. Off by default:
-- the organization enables them in line with its consent/privacy policy.
alter table public.site_settings
  add column public_show_photo boolean not null default false,
  add column public_show_parents boolean not null default false,
  add column public_show_dob boolean not null default false;

-- Opaque, unguessable code printed as a QR on result sheets (no personal data).
create or replace function public.random_code(n int) returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, n);
$$;

alter table public.results add column verify_code text;
-- Schema maintenance on existing rows: user triggers off (see 20261031000100).
alter table public.results disable trigger user;
update public.results set verify_code = public.random_code(12) where verify_code is null;
alter table public.results enable trigger user;
insert into public.audit_logs (action, table_name, record_id, new_data, reason)
select 'migration.backfill', 'results', '20261031000200', jsonb_build_object('rows', count(*)), 'Schema upgrade: verification codes for result sheets'
from public.results;
alter table public.results
  alter column verify_code set default public.random_code(12),
  alter column verify_code set not null,
  add constraint results_verify_code_key unique (verify_code);

-- Public lookup with two identifiers: roll+registration, passport+roll or
-- passport+registration. Published results only; the passport is never
-- returned; optional personal details follow the privacy settings.
create or replace function public.public_result_lookup_v2(p_method text, p_first text, p_second text)
returns table (
  student_name text, student_name_bn text, father_name text, mother_name text, date_of_birth date, photo_path text,
  roll_no text, registration_no text,
  institute_name text, institute_code text, institute_registration_no text,
  course_title text, course_code text, course_duration_months int, course_duration_override text,
  session_name text, exam_name text, exam_code text, exam_date date, passing_year int,
  theory_marks numeric, practical_marks numeric, viva_marks numeric,
  theory_full numeric, practical_full numeric, viva_full numeric,
  total_marks numeric, full_marks numeric, percentage numeric,
  grade text, grade_point numeric, scale_max_point numeric, is_pass boolean,
  display_published_on date, verify_code text, version int
)
language sql stable security definer set search_path = '' as $$
  with settings as (select public_show_photo, public_show_parents, public_show_dob from public.site_settings where id = 1),
  a as (select upper(regexp_replace(btrim(coalesce(p_first, '')), '\s', '', 'g')) as v),
  b as (select upper(regexp_replace(btrim(coalesce(p_second, '')), '\s', '', 'g')) as v)
  select s.name_en, s.name_bn,
         case when st.public_show_parents then s.father_name end,
         case when st.public_show_parents then s.mother_name end,
         case when st.public_show_dob then s.date_of_birth end,
         case when st.public_show_photo then s.photo_path end,
         s.roll_no, s.registration_no,
         i.name_en, i.code, i.registration_no,
         c.title_en, c.code, c.duration_months, s.course_duration_override,
         ses.name, e.name, e.code, e.exam_date, s.passing_year,
         r.theory_marks, r.practical_marks, r.viva_marks,
         e.theory_full_marks, e.practical_full_marks, e.viva_full_marks,
         r.total_marks, r.full_marks, r.percentage,
         r.grade, r.grade_point, g.max_point, r.is_pass,
         r.display_published_on, r.verify_code, r.version
  from public.students s
  cross join settings st
  cross join a
  cross join b
  join public.results r on r.student_id = s.id and r.status = 'published'
  join public.exams e on e.id = r.exam_id
  join public.courses c on c.id = e.course_id
  join public.academic_sessions ses on ses.id = e.session_id
  join public.institutes i on i.id = s.institute_id
  left join public.grade_scales g on g.id = r.grade_scale_id
  where a.v <> '' and b.v <> ''
    and case p_method
          when 'roll_reg' then s.roll_no = a.v and s.registration_no = b.v
          when 'passport_roll' then s.passport_no = a.v and s.roll_no = b.v
          when 'passport_reg' then s.passport_no = a.v and s.registration_no = b.v
          else false
        end
  order by e.exam_date desc nulls last, r.published_at desc;
$$;

-- QR verification of a result sheet: status plus the minimum identifying data.
create or replace function public.public_verify_result(p_code text, p_version int)
returns table (status text, student_name text, roll_no text, registration_no text, institute_name text,
               course_title text, exam_name text, grade text, grade_point numeric, total_marks numeric, full_marks numeric,
               display_published_on date, current_version int)
language sql stable security definer set search_path = '' as $$
  select case when r.status <> 'published' then 'withdrawn'
              when p_version is not null and p_version < r.version then 'superseded'
              else 'valid' end,
         s.name_en, s.roll_no, s.registration_no, i.name_en, c.title_en, e.name,
         case when r.status = 'published' then r.grade end,
         case when r.status = 'published' then r.grade_point end,
         case when r.status = 'published' then r.total_marks end,
         case when r.status = 'published' then r.full_marks end,
         r.display_published_on, r.version
  from public.results r
  join public.students s on s.id = r.student_id
  join public.institutes i on i.id = r.institute_id
  join public.exams e on e.id = r.exam_id
  join public.courses c on c.id = e.course_id
  where r.verify_code = upper(btrim(p_code))
    and r.first_published_at is not null;  -- never-published drafts do not exist publicly
$$;

grant execute on function public.random_code(int) to authenticated;  -- column default for results inserted by staff
grant execute on function public.public_result_lookup_v2(text, text, text) to service_role;
grant execute on function public.public_verify_result(text, int) to service_role;
