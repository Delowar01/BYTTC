-- Upgrade-path regression test, part 3 (runs as the CLI-style login role,
-- like the migrations): after the upgrade the result guards must be active
-- again, so a non-application session cannot unpublish published results.
set role postgres;
do $$
begin
  begin
    update public.results set status = 'draft' where status = 'published';
    raise exception 'GUARD_DISABLED';
  exception when others then
    if sqlerrm = 'GUARD_DISABLED' then
      raise exception 'Result guards are not active after the upgrade';
    end if;
  end;
end $$;
select 'result guards active' as result;
