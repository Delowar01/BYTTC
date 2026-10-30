-- Upgrade-path regression test, part 2 (runs as postgres after the newer
-- migrations were applied). Any failed assertion aborts with its message.

-- Columns that existed before the upgrade, compared with their stored values.
create function upgrade_check.changed(old_row jsonb, new_row jsonb) returns boolean
language sql immutable as $$
  select coalesce((select jsonb_object_agg(key, value) from jsonb_each(new_row) where old_row ? key), '{}') <> old_row;
$$;

do $$
declare
  bad int;
  v text;
begin
  select max(version) into v from supabase_migrations.schema_migrations;
  assert v = '20261031000300', format('latest recorded migration is %s', v);

  -- Existing academic records are unchanged in every pre-existing column
  -- (marks, totals, grades, status, published_at, updated_at, version, ...).
  select count(*) into bad from upgrade_check.results o left join public.results n on n.id = o.id
   where n.id is null or upgrade_check.changed(o.row, to_jsonb(n));
  assert bad = 0, format('%s existing result(s) changed or missing', bad);
  select count(*) into bad from upgrade_check.certificates o left join public.certificates n on n.id = o.id
   where n.id is null or upgrade_check.changed(o.row, to_jsonb(n));
  assert bad = 0, format('%s existing certificate(s) changed or missing', bad);
  select count(*) into bad from upgrade_check.students o left join public.students n on n.id = o.id
   where n.id is null or upgrade_check.changed(o.row, to_jsonb(n));
  assert bad = 0, format('%s existing student(s) changed or missing', bad);

  -- Backfills
  assert not exists (select 1 from public.results where status = 'published'
                      and (first_published_at is distinct from published_at or display_published_on is null)),
    'publication history not backfilled from published_at';
  assert not exists (select 1 from public.results where full_marks is null or grade_scale_id is null or verify_code is null),
    'derived result columns not backfilled';
  assert not exists (select 1 from public.students s join upgrade_check.students o on o.id = s.id where s.enrollment_date is not null),
    'existing students were given an invented enrollment date';

  -- Certificates issued before the upgrade still verify (and keep their links)
  assert not exists (select 1 from public.certificates c
                      where c.status = 'valid'
                        and (select status from public.public_verify_certificate(c.certificate_no)) is distinct from 'valid'),
    'a valid pre-upgrade certificate no longer verifies';
  assert exists (select 1 from public.certificates c cross join lateral public.public_verify_certificate(c.certificate_no) x
                  where c.status = 'revoked' and x.superseded_by is not null),
    'a superseded certificate lost the link to its replacement';
  assert not exists (select 1 from public.certificates c join upgrade_check.certificates o on o.id = c.id where c.layout is not null),
    'a pre-upgrade certificate gained a template layout';

  -- Published results stay publicly findable and their sheets verify
  assert not exists (select 1 from public.results r join public.students s on s.id = r.student_id
                      where r.status = 'published'
                        and not exists (select 1 from public.public_result_lookup_v2('roll_reg', s.roll_no, s.registration_no) l
                                         where l.verify_code = r.verify_code)),
    'a published result is not found by the public lookup';
  assert not exists (select 1 from public.results r where r.status = 'published'
                      and (select status from public.public_verify_result(r.verify_code, r.version)) is distinct from 'valid'),
    'a published result sheet does not verify';
  assert not exists (select 1 from public.results r where r.status <> 'published'
                      and exists (select 1 from public.public_verify_result(r.verify_code, r.version))),
    'an unpublished result became publicly verifiable';

  -- Guards are back on and the backfills are recorded once each
  assert not exists (select 1 from pg_trigger where tgrelid = 'public.results'::regclass and not tgisinternal and tgenabled = 'D'),
    'results triggers were left disabled';
  assert (select count(*) from public.audit_logs where action = 'migration.backfill') = 2,
    'expected one audit entry per backfill';
  assert (select count(*) from public.document_templates where status = 'active') = 3,
    'expected active marksheet, admit card and registration card templates';
end $$;

select (select count(*) from public.results where status = 'published') as published_results,
       (select count(*) from public.certificates where status = 'valid') as valid_certificates,
       'all upgrade assertions passed' as result;
