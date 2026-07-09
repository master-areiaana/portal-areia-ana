-- Habilita login por usuário + senha usando o Supabase Auth por baixo.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não altera senhas, não altera Auth e não apaga usuários.
-- O e-mail continua existindo internamente para convite, recuperação de senha e Supabase Auth.

alter table public.portal_profiles
  add column if not exists username text;

-- Preenche username inicial com a parte antes do @ para usuários existentes.
-- Depois o suporte pode ajustar manualmente no Controle de Acessos > Usuários.
update public.portal_profiles
   set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]+', '', 'g'))
 where (username is null or trim(username) = '')
   and email is not null;

create unique index if not exists uq_portal_profiles_username_lower
  on public.portal_profiles (lower(username))
  where username is not null and trim(username) <> '';

create or replace function public.portal_resolve_login_identifier(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select p.email
    into v_email
    from public.portal_profiles p
   where lower(p.username) = lower(trim(p_identifier))
     and p.status = 'ativo'
   limit 1;

  return v_email;
end;
$$;

revoke all on function public.portal_resolve_login_identifier(text) from public;
grant execute on function public.portal_resolve_login_identifier(text) to anon, authenticated;

-- Conferência.
select nome, username, email, status
from public.portal_profiles
order by nome;
