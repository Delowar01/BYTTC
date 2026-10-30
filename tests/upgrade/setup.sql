-- Upgrade-path regression test, part 1 (runs as postgres on the PRE-upgrade
-- schema + seed). Creates the history a running deployment has, then
-- fingerprints every existing row so the assertions can prove the upgrade
-- leaves academic records untouched.

do $$
declare
  r record;
  c public.certificates;
  n int := 0;
begin
  -- Valid certificates for every published, passing result
  for r in select id from public.results where status = 'published' and is_pass order by id loop
    perform public.issue_certificate_internal(r.id);
    n := n + 1;
  end loop;
  if n < 2 then raise exception 'Seed data has too few published, passing results (%)', n; end if;

  -- A correction history: the first certificate was reissued (old one superseded)
  select * into c from public.certificates where status = 'valid' order by certificate_no limit 1;
  perform set_config('app.change_reason', 'Upgrade test: reissue', true);
  update public.certificates
     set status = 'revoked', revoked_at = now(), revoke_reason = 'Superseded: upgrade test'
   where id = c.id;
  perform public.issue_certificate_internal(c.result_id, c.id);
end $$;

-- An unpublished draft as well
insert into public.results (exam_id, student_id, institute_id, theory_marks, practical_marks)
select e.id, s.id, s.institute_id, 30, 10
  from public.exams e
  join public.students s on s.course_id = e.course_id and s.session_id = e.session_id
 where not exists (select 1 from public.results x where x.exam_id = e.id and x.student_id = s.id)
 order by e.code, s.roll_no
 limit 1;

drop schema if exists upgrade_check cascade;
create schema upgrade_check;
create table upgrade_check.results as select id, to_jsonb(r) as row from public.results r;
create table upgrade_check.certificates as select id, to_jsonb(c) as row from public.certificates c;
create table upgrade_check.students as select id, to_jsonb(s) as row from public.students s;

select (select count(*) from public.results where status = 'published') as published_results,
       (select count(*) from public.certificates where status = 'valid') as valid_certificates,
       (select count(*) from public.certificates where status = 'revoked') as superseded_certificates;
