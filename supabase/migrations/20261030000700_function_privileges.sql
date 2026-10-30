-- Hardening: anonymous visitors may execute only these public functions.
-- (Everything else is either granted to `authenticated` explicitly or is
-- called only by the server with the service role.)
revoke execute on all functions in schema public from public, anon;

grant execute on function public.public_institutes(text) to anon;
grant execute on function public.public_stats()          to anon;
grant execute on function public.is_safe_url(text)       to anon;

alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
