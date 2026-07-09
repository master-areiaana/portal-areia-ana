-- Corrige somente o cadastro do Admin/Diretoria no portal.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não altera Auth, não altera senha, não apaga usuários, não altera permissões.

-- Problema diagnosticado:
-- 1) portal_profiles.validade_acesso estava vencida, fazendo portal_is_active() retornar false.
-- 2) username estava como 'admin', mas o login operacional desejado é 'areia.ana.gestao'.

-- Conferência antes da alteração.
select
  id,
  nome,
  email,
  username,
  status,
  validade_acesso
from public.portal_profiles
where id = 'd8b669db-4c33-44cd-af7b-cfe7ce154426'
   or lower(email) = 'areia.ana.gestao@gmail.com'
   or lower(username) in ('admin', 'areia.ana.gestao')
order by email, username;

-- Proteção: impede alteração se outro usuário já estiver usando o username desejado.
do $$
declare
  v_conflict_count integer;
  v_target_count integer;
begin
  select count(*)
    into v_conflict_count
    from public.portal_profiles
   where lower(username) = 'areia.ana.gestao'
     and id <> 'd8b669db-4c33-44cd-af7b-cfe7ce154426';

  if v_conflict_count > 0 then
    raise exception 'Já existe outro usuário com username areia.ana.gestao. Alteração cancelada.';
  end if;

  select count(*)
    into v_target_count
    from public.portal_profiles
   where id = 'd8b669db-4c33-44cd-af7b-cfe7ce154426'
     and lower(email) = 'areia.ana.gestao@gmail.com';

  if v_target_count <> 1 then
    raise exception 'Usuário alvo não encontrado ou inconsistente. Alteração cancelada.';
  end if;

  update public.portal_profiles
     set validade_acesso = null,
         username = 'areia.ana.gestao'
   where id = 'd8b669db-4c33-44cd-af7b-cfe7ce154426'
     and lower(email) = 'areia.ana.gestao@gmail.com';
end;
$$;

-- Validação depois da alteração.
select
  id,
  nome,
  email,
  username,
  status,
  validade_acesso,
  public.portal_is_active() as portal_is_active_contexto_sql_editor
from public.portal_profiles
where id = 'd8b669db-4c33-44cd-af7b-cfe7ce154426'
   or lower(email) = 'areia.ana.gestao@gmail.com'
order by email, username;

-- Validação das permissões individuais já existentes para o Admin/Diretoria.
select
  p.nome,
  p.email,
  p.username,
  p.status,
  p.validade_acesso,
  m.codigo as modulo,
  m.nome as modulo_nome,
  up.resource_id is null as aba_inteira,
  coalesce(r.codigo, 'ABA') as resource_codigo,
  coalesce(r.titulo, 'ABA INTEIRA') as item,
  up.effect,
  up.can_view,
  up.can_open,
  up.can_manage
from public.portal_user_permissions up
join public.portal_profiles p on p.id = up.user_id
join public.portal_modules m on m.id = up.module_id
left join public.portal_resources r on r.id = up.resource_id
where p.id = 'd8b669db-4c33-44cd-af7b-cfe7ce154426'
order by m.ordem, up.resource_id is not null, r.ordem;
