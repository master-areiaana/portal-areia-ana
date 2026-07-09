-- Corrige somente o cadastro e as permissoes do usuario Adilson Casagrande.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Nao altera Auth, nao altera senha, nao apaga usuarios, nao altera funcoes.

-- Contexto:
-- O portal mostra o usuario Adilson Casagrande com perfil Gestao,
-- mas exibe "Nenhum acesso liberado para este usuario".
-- Este script corrige os motivos operacionais mais provaveis:
-- 1) status diferente de ativo;
-- 2) validade_acesso vencida;
-- 3) ausencia de permissoes individuais.

-- Conferencia antes da alteracao.
select
  id,
  nome,
  email,
  username,
  status,
  role_codigo,
  validade_acesso
from public.portal_profiles
where lower(nome) like '%adilson%'
   or lower(email) = 'coordenadormineracao@areiaana.com.br'
   or lower(username) = 'coordenadormineracao'
order by email, username;

-- Correcao protegida: so executa se encontrar exatamente um usuario alvo.
do $$
declare
  v_user_id uuid;
  v_target_count integer;
  v_conflict_count integer;
begin
  select count(*)
    into v_target_count
    from public.portal_profiles
   where lower(email) = 'coordenadormineracao@areiaana.com.br'
      or lower(username) = 'coordenadormineracao'
      or lower(nome) = 'adilson casagrande';

  if v_target_count <> 1 then
    raise exception 'Foram encontrados % possiveis usuarios Adilson. Alteracao cancelada para evitar atingir usuario errado.', v_target_count;
  end if;

  select id
    into v_user_id
    from public.portal_profiles
   where lower(email) = 'coordenadormineracao@areiaana.com.br'
      or lower(username) = 'coordenadormineracao'
      or lower(nome) = 'adilson casagrande'
   limit 1;

  select count(*)
    into v_conflict_count
    from public.portal_profiles
   where lower(username) = 'coordenadormineracao'
     and id <> v_user_id;

  if v_conflict_count > 0 then
    raise exception 'Ja existe outro usuario com username coordenadormineracao. Alteracao cancelada.';
  end if;

  update public.portal_profiles
     set status = 'ativo',
         validade_acesso = null,
         username = 'coordenadormineracao'
   where id = v_user_id;

  -- Recria permissoes individuais do Adilson para os modulos normais.
  -- Nao libera Controle de Acessos/admin.
  delete from public.portal_user_permissions
   where user_id = v_user_id;

  insert into public.portal_user_permissions
    (user_id, module_id, resource_id, effect, can_view, can_open, can_manage)
  select
    v_user_id,
    m.id,
    null,
    'allow',
    true,
    true,
    false
  from public.portal_modules m
  where m.ativo = true
    and m.codigo <> 'admin';

  insert into public.portal_user_permissions
    (user_id, module_id, resource_id, effect, can_view, can_open, can_manage)
  select
    v_user_id,
    r.module_id,
    r.id,
    'allow',
    true,
    true,
    false
  from public.portal_resources r
  join public.portal_modules m on m.id = r.module_id
  where r.ativo = true
    and m.ativo = true
    and m.codigo <> 'admin';
end;
$$;

-- Validacao depois da alteracao.
select
  id,
  nome,
  email,
  username,
  status,
  role_codigo,
  validade_acesso
from public.portal_profiles
where lower(nome) like '%adilson%'
   or lower(email) = 'coordenadormineracao@areiaana.com.br'
   or lower(username) = 'coordenadormineracao'
order by email, username;

-- Validacao das permissoes individuais do Adilson.
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
where lower(p.nome) like '%adilson%'
   or lower(p.email) = 'coordenadormineracao@areiaana.com.br'
   or lower(p.username) = 'coordenadormineracao'
order by m.ordem, up.resource_id is not null, r.ordem;
