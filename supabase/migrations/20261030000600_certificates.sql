-- Phase 3: certificate issuance, revocation and reissue.

-- A result may have many certificates over time (reissues), but at most one valid.
alter table public.certificates drop constraint certificates_result_id_key;
create unique index certificates_one_valid_per_result on public.certificates (result_id) where status = 'valid';
alter table public.certificates
  add column supersedes_id uuid references public.certificates (id) on delete restrict,
  add column snapshot jsonb not null default '{}'::jsonb;  -- credential data as issued
create index certificates_student_idx on public.certificates (student_id);

-- Signatory labels printed on certificates (editable in Site settings).
alter table public.site_settings
  add column cert_title_en text not null default 'Certificate of Completion',
  add column cert_signatory_left text not null default 'Controller of Examinations',
  add column cert_signatory_right text not null default 'Director';

-- Certificate numbers: <PREFIX>-<YY>-<8 random chars> (Crockford base32, no
-- ambiguous letters). Random so that numbers cannot be enumerated.
create or replace function public.generate_certificate_no() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  prefix text;
  v text;
  i int;
begin
  select upper(regexp_replace(coalesce(nullif(short_name, ''), 'CERT'), '[^A-Za-z0-9]', '', 'g'))
    into prefix from public.site_settings where id = 1;
  prefix := left(coalesce(nullif(prefix, ''), 'CERT'), 8);
  loop
    v := '';
    for i in 1..8 loop
      v := v || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    v := prefix || '-' || to_char(now(), 'YY') || '-' || v;
    exit when not exists (select 1 from public.certificates c where c.certificate_no = v);
  end loop;
  return v;
end $$;

-- Issue one certificate for a published, passing result (internal helper).
create or replace function public.issue_certificate_internal(p_result_id uuid, p_supersedes uuid default null)
returns public.certificates
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  c public.certificates;
begin
  select res.id, res.status, res.is_pass, res.grade, res.grade_point, res.total_marks, res.percentage,
         res.student_id, res.institute_id,
         s.name_en, s.name_bn, s.roll_no, s.registration_no, s.father_name,
         i.name_en as institute_name, i.code as institute_code,
         co.title_en as course_title, co.code as course_code, co.duration_months,
         ses.name as session_name, e.name as exam_name, e.code as exam_code, e.exam_date
    into r
    from public.results res
    join public.students s on s.id = res.student_id
    join public.institutes i on i.id = res.institute_id
    join public.exams e on e.id = res.exam_id
    join public.courses co on co.id = e.course_id
    join public.academic_sessions ses on ses.id = e.session_id
   where res.id = p_result_id;
  if not found then raise exception 'Result not found'; end if;
  if r.status <> 'published' then raise exception 'Certificates can only be issued for published results'; end if;
  if not r.is_pass then raise exception 'Certificates can only be issued for passing results'; end if;

  insert into public.certificates (certificate_no, result_id, student_id, institute_id, issued_by, supersedes_id, snapshot)
  values (
    public.generate_certificate_no(), r.id, r.student_id, r.institute_id, auth.uid(), p_supersedes,
    jsonb_build_object(
      'student_name', r.name_en, 'student_name_bn', r.name_bn, 'father_name', r.father_name,
      'roll_no', r.roll_no, 'registration_no', r.registration_no,
      'institute_name', r.institute_name, 'institute_code', r.institute_code,
      'course_title', r.course_title, 'course_code', r.course_code, 'duration_months', r.duration_months,
      'session_name', r.session_name, 'exam_name', r.exam_name, 'exam_code', r.exam_code, 'exam_date', r.exam_date,
      'grade', r.grade, 'grade_point', r.grade_point, 'total_marks', r.total_marks, 'percentage', r.percentage
    )
  )
  returning * into c;
  return c;
end $$;

-- Issue certificates for selected results (publishers only). Skips results
-- that already hold a valid certificate or are not eligible.
create or replace function public.issue_certificates(p_result_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
  issued int := 0;
  skipped int := 0;
begin
  if not public.can_publish() then
    raise exception 'Only authorized central roles may issue certificates';
  end if;
  foreach rid in array p_result_ids loop
    if exists (select 1 from public.certificates where result_id = rid and status = 'valid')
       or not exists (select 1 from public.results where id = rid and status = 'published' and is_pass) then
      skipped := skipped + 1;
    else
      perform public.issue_certificate_internal(rid);
      issued := issued + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'issued', issued, 'skipped', skipped);
end $$;

create or replace function public.issue_exam_certificates(p_exam_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return public.issue_certificates(array(
    select id from public.results where exam_id = p_exam_id and status = 'published' and is_pass
  ));
end $$;

create or replace function public.revoke_certificate(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.certificates;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may revoke certificates'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  perform set_config('app.change_reason', p_reason, true);
  update public.certificates
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
   where id = p_id and status = 'valid'
  returning * into c;
  if not found then raise exception 'Certificate not found or already revoked'; end if;
  return jsonb_build_object('ok', true, 'certificate_no', c.certificate_no);
end $$;

-- Correction workflow: revoke the current certificate and issue a new one
-- from the (corrected) result, linked to its predecessor.
create or replace function public.reissue_certificate(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  old public.certificates;
  fresh public.certificates;
begin
  if not public.can_publish() then raise exception 'Only authorized central roles may reissue certificates'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  select * into old from public.certificates where id = p_id and status = 'valid' for update;
  if not found then raise exception 'Only valid certificates can be reissued'; end if;
  perform set_config('app.change_reason', 'Reissued: ' || p_reason, true);
  update public.certificates
     set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Superseded: ' || p_reason
   where id = old.id;
  fresh := public.issue_certificate_internal(old.result_id, old.id);
  return jsonb_build_object('ok', true, 'certificate_no', fresh.certificate_no, 'id', fresh.id);
end $$;

-- Results with a valid certificate cannot be unpublished (revoke first).
create or replace function public.results_certificate_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'published' and new.status <> 'published'
     and exists (select 1 from public.certificates where result_id = new.id and status = 'valid') then
    raise exception 'Result % has a valid certificate; revoke the certificate before unpublishing', new.id;
  end if;
  return new;
end $$;
create trigger results_certificate_guard before update on public.results
  for each row execute function public.results_certificate_guard();

-- Public verification now reads the issued snapshot (what was certified).
drop function public.public_verify_certificate(text);
create or replace function public.public_verify_certificate(p_certificate_no text)
returns table (
  certificate_no text, status text, issued_at timestamptz, revoked_at timestamptz,
  student_name text, roll_no text, registration_no text, institute_name text, course_title text,
  session_name text, grade text, grade_point numeric, superseded_by text
)
language sql stable security definer set search_path = '' as $$
  select ce.certificate_no, ce.status, ce.issued_at, ce.revoked_at,
         ce.snapshot ->> 'student_name', ce.snapshot ->> 'roll_no', ce.snapshot ->> 'registration_no',
         ce.snapshot ->> 'institute_name', ce.snapshot ->> 'course_title', ce.snapshot ->> 'session_name',
         ce.snapshot ->> 'grade', (ce.snapshot ->> 'grade_point')::numeric,
         (select n.certificate_no from public.certificates n where n.supersedes_id = ce.id and n.status = 'valid')
  from public.certificates ce
  where ce.certificate_no = upper(btrim(p_certificate_no));
$$;

revoke execute on function public.generate_certificate_no() from public, anon, authenticated;
revoke execute on function public.issue_certificate_internal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_certificates(uuid[]) to authenticated;
grant execute on function public.issue_exam_certificates(uuid) to authenticated;
grant execute on function public.revoke_certificate(uuid, text) to authenticated;
grant execute on function public.reissue_certificate(uuid, text) to authenticated;
grant execute on function public.public_verify_certificate(text) to service_role;
