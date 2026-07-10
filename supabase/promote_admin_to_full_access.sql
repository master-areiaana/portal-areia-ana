-- Promove o perfil Admin / Diretoria para acesso total equivalente ao Suporte.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Nao altera Auth, nao altera senha, nao apaga usuarios.
-- A conta tecnica portalcore.consult@gmail.com continua existindo e deve continuar oculta no front-end.

-- 1) Conferencia antes da alteracao.
select
  r.codigo,
  r.nome,
  r.is_admin
from public.portal_roles r
where r.codigo in ('suporte', 'admin', 'diretoria')
order by r.codigo;

select
  p.id,
  p.nome,
  p.email,
  p.username,
  p.status,
  p.validade_acesso,
  r.codigo as role_codigo,
  r.nome as role_nome,
  r.is_admin
from public.portal_profiles p
join public.portal_roles r on r.id = p.role_id
where lower(p.email) in ('areia.ana.gestao@gmail.com', 'portalcore.consult@gmail.com')
   or r.codigo in ('admin', 'suporte')
order by r.codigo, p.nome;

-- 2) Torna o perfil Admin / Diretoria equivalente ao Suporte em nivel de permissao do portal.
update public.portal_roles
   set is_admin = true,
       updated_at = now()
 where codigo = 'admin';

-- 3) Garante que o usuario Admin/Diretoria principal esteja ativo, sem validade vencida e com username correto.
update public.portal_profiles
   set status = 'ativo',
       validade_acesso = null,
       username = 'areia.ana.gestao',
       updated_at = now()
 where lower(email) = 'areia.ana.gestao@gmail.com';

-- 4) Validacao depois da alteracao.
select
  r.codigo,
  r.nome,
  r.is_admin
from public.portal_roles r
where r.codigo in ('suporte', 'admin', 'diretoria')
order by r.codigo;

select
  p.id,
  p.nome,
  p.email,
  p.username,
  p.status,
  p.validade_acesso,
  r.codigo as role_codigo,
  r.nome as role_nome,
  r.is_admin
from public.portal_profiles p
join public.portal_roles r on r.id = p.role_id
where lower(p.email) in ('areia.ana.gestao@gmail.com', 'portalcore.consult@gmail.com')
   or r.codigo in ('admin', 'suporte')
order by r.codigo, p.nome;

-- Esperado para areia.ana.gestao@gmail.com:
-- username = areia.ana.gestao
-- status = ativo
-- validade_acesso = null
-- role_codigo = admin
-- is_admin = true
