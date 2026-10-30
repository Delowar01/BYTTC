-- Reporting aggregates. SECURITY INVOKER: row level security applies, so
-- institute users only ever see figures for their own institute.
create or replace function public.report_results(p_exam_id uuid default null)
returns table (exam_id uuid, exam_code text, exam_name text, institute_code text, institute_name text,
               status text, grade text, is_pass boolean, n bigint)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.code, e.name, i.code, i.name_en, r.status::text, r.grade, r.is_pass, count(*)
  from public.results r
  join public.exams e on e.id = r.exam_id
  join public.institutes i on i.id = r.institute_id
  where p_exam_id is null or r.exam_id = p_exam_id
  group by e.id, e.code, e.name, i.code, i.name_en, r.status, r.grade, r.is_pass;
$$;

create or replace function public.report_students()
returns table (institute_code text, institute_name text, course_code text, session_name text, status text, n bigint)
language sql stable security invoker set search_path = '' as $$
  select i.code, i.name_en, c.code, s.name, st.status::text, count(*)
  from public.students st
  join public.institutes i on i.id = st.institute_id
  join public.courses c on c.id = st.course_id
  join public.academic_sessions s on s.id = st.session_id
  group by i.code, i.name_en, c.code, s.name, st.status;
$$;

grant execute on function public.report_results(uuid) to authenticated;
grant execute on function public.report_students() to authenticated;
