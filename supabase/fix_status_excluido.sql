-- Correção para permitir soft delete de usuários no portal.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não apaga usuários do Auth e não altera senhas.

alter table public.portal_profiles
  drop constraint if exists portal_profiles_status_check;

alter table public.portal_profiles
  add constraint portal_profiles_status_check
  check (status in ('ativo','inativo','bloqueado','excluido'));
