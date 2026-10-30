-- Bulk student import: identifier availability check and transactional commit.

-- Which of the given roll / registration numbers are already in use (across
-- all institutes). Returns only the identifiers, never any student data.
create or replace function public.identifiers_in_use(p_rolls text[], p_registrations text[])
returns table (kind text, value text)
language sql stable security definer set search_path = '' as $$
  select 'roll', s.roll_no from public.students s
   where public.has_role(array['super_admin','central_admin','central_staff','institute_admin','institute_staff']::public.app_role[])
     and s.roll_no = any (p_rolls)
  union all
  select 'registration', s.registration_no from public.students s
   where public.has_role(array['super_admin','central_admin','central_staff','institute_admin','institute_staff']::public.app_role[])
     and s.registration_no = any (p_registrations);
$$;

-- Insert every staged student row in one transaction (RLS applies: tenants
-- can only insert students of their own institute).
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
      father_name, mother_name, date_of_birth, gender, phone, email, address
    )
    select x.institute_id, x.course_id, x.session_id,
           coalesce(nullif(x.roll_no, ''), nextval('public.student_roll_seq')::text),
           coalesce(x.registration_no, ''),
           x.name_en, x.name_bn, x.father_name, x.mother_name, x.date_of_birth, x.gender,
           x.phone, x.email, x.address
    from jsonb_to_recordset(b.payload) as x (
      institute_id uuid, course_id uuid, session_id uuid, roll_no text, registration_no text,
      name_en text, name_bn text, father_name text, mother_name text, date_of_birth date,
      gender text, phone text, email text, address text
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

-- Discard a validated (uncommitted) batch.
create or replace function public.discard_batch(p_batch_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare b public.import_batches;
begin
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status not in ('validated', 'failed') then
    raise exception 'Only uncommitted batches can be discarded (status %)', b.status;
  end if;
  update public.import_batches
     set status = 'rolled_back', rolled_back_at = now(), rolled_back_by = auth.uid(),
         notes = coalesce(notes || E'\n', '') || 'Discarded before commit'
   where id = b.id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.identifiers_in_use(text[], text[]) to authenticated;
grant execute on function public.commit_student_batch(uuid)         to authenticated;
grant execute on function public.discard_batch(uuid)                to authenticated;
