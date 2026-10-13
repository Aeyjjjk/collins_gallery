-- Tiny public endpoint used by the keep-alive workflow. Reads nothing sensitive.
create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function public.ping() to anon, authenticated;
