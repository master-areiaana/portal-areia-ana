-- Diagnóstico e correção do contexto do usuário Admin / Diretoria.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não altera Auth, não altera senha e não apaga usuários.

-- 1) Garante que o profile do e-mail da diretoria esteja ativo e vinculado ao role de código admin.
update public.portal_profiles p
   set status = 'ativo',
       role_id = r.id,
       updated_at = now()
  from public.portal_roles r
 where lower(p.email) = 'areia.ana.gestao@gmail.com'
   and r.codigo = 'admin';

-- 2) Garante que as permissões do role admin estejam gravadas para as abas normais.
delete from public.portal_role_permissions rp
using public.portal_roles r
where rp.role_id = r.id
  and r.codigo = 'admin'
  and rp.resource_id is null;

insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m
  on m.codigo in ('indicadores','comercial','rh','sistemas','calendario')
where r.codigo = 'admin';

-- 3) Garante que admin não tenha permissão de módulo Controle de Acessos.
delete from public.portal_role_permissions rp
using public.portal_roles r, public.portal_modules m
where rp.role_id = r.id
  and rp.module_id = m.id
  and r.codigo = 'admin'
  and m.codigo = 'admin';

-- 4) Confere o profile e o role do usuário.
select
  p.id,
  p.nome,
  p.email,
  p.status,
  r.codigo as role_codigo,
  r.nome as role_nome,
  r.is_admin
from public.portal_profiles p
left join public.portal_roles r on r.id = p.role_id
where lower(p.email) = 'areia.ana.gestao@gmail.com';

-- 5) Confere os módulos liberados para o role admin.
select
  r.codigo as perfil,
  r.nome as nome_perfil,
  r.is_admin,
  coalesce(json_agg(m.codigo order by m.ordem) filter (where m.codigo is not null), '[]') as modulos_liberados
from public.portal_roles r
left join public.portal_role_permissions rp
  on rp.role_id = r.id
 and rp.resource_id is null
 and rp.can_view = true
left join public.portal_modules m on m.id = rp.module_id
where r.codigo = 'admin'
group by r.codigo, r.nome, r.is_admin;

-- 6) Diagnóstico de todos os módulos e se o role admin tem permissão.
select
  m.codigo as modulo,
  m.nome,
  m.ativo,
  coalesce(rp.can_view, false) as can_view,
  coalesce(rp.can_open, false) as can_open,
  coalesce(rp.can_manage, false) as can_manage
from public.portal_modules m
left join public.portal_roles r on r.codigo = 'admin'
left join public.portal_role_permissions rp
  on rp.role_id = r.id
 and rp.module_id = m.id
 and rp.resource_id is null
order by m.ordem;
