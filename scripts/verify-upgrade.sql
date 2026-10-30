-- Read-only check after applying the academic-documents upgrade migrations
-- (20261031000100–20261031000300). Paste into Supabase → SQL Editor → Run.
-- Changes nothing. Expected values are in the right-hand column.
select 'latest migration' as check, max(version) as value, '20261031000300' as expected from supabase_migrations.schema_migrations
union all select 'public tables WITHOUT RLS', count(*)::text, '0' from pg_tables where schemaname = 'public' and not rowsecurity
union all select 'functions anon can execute', string_agg(p.proname, ', ' order by p.proname), 'is_safe_url, public_institutes, public_stats'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
union all select 'grade scales', string_agg(code || ' v' || version, ', ' order by code), 'GPA4 v1, GPA5 v1 (more if edited)' from public.grade_scales where is_current
union all select 'results without verify code', count(*)::text, '0' from public.results where verify_code is null
union all select 'published results without first publication time', count(*)::text, '0' from public.results where status = 'published' and first_published_at is null
union all select 'results without full marks', count(*)::text, '0' from public.results where full_marks is null
union all select 'active document templates', string_agg(doc_type::text, ', ' order by doc_type::text), 'marksheet, admit_card, registration_card' from public.document_templates where status = 'active'
union all select 'certificate templates (draft)', count(*)::text, '1 (certificates keep the built-in design until one is activated)' from public.document_templates where doc_type = 'certificate' and status = 'draft'
union all select 'document-templates bucket', string_agg(id || case when public then ' (PUBLIC!)' else ' (private)' end, ', '), 'document-templates (private)' from storage.buckets where id = 'document-templates'
union all select 'issued admit/registration cards', count(*)::text, '0 right after the upgrade' from public.documents
union all select 'certificates still valid', count(*)::text, 'same number as before the upgrade' from public.certificates where status = 'valid'
union all select 'published results', count(*)::text, 'same number as before the upgrade' from public.results where status = 'published';
