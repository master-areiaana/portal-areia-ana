-- Correção para Admin / Diretoria voltar a enxergar as abas normais.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não altera senhas, não altera Auth e não libera Controle de Acessos para admin/diretoria.

-- Garante a regra de perfis:
-- suporte = técnico com Controle de Acessos
-- admin/diretoria = acesso amplo às abas normais, sem Controle de Acessos
update public.portal_roles
   set is_admin = true,
       nome = 'Suporte',
       updated_at = now()
 where codigo = 'suporte';

update public.portal_roles
   set is_admin = false,
       nome = 'Admin / Diretoria',
       updated_at = now()
 where codigo = 'admin';

update public.portal_roles
   set is_admin = false,
       updated_at = now()
 where codigo = 'diretoria';

update public.portal_modules
   set nome = 'Controle de Acessos',
       updated_at = now()
 where codigo = 'admin';

-- Remove permissões antigas somente dos perfis admin/diretoria.
delete from public.portal_role_permissions rp
using public.portal_roles r
where rp.role_id = r.id
  and r.codigo in ('admin','diretoria');

-- Admin / Diretoria: abas normais, sem Controle de Acessos.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m
  on m.codigo in ('indicadores','comercial','rh','sistemas','calendario')
where r.codigo = 'admin';

-- Diretoria: abas normais, sem Controle de Acessos.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m
  on m.codigo in ('indicadores','comercial','rh','sistemas','calendario')
where r.codigo = 'diretoria';

-- Conferência final.
select
  r.codigo as perfil,
  r.nome as nome_perfil,
  r.is_admin,
  coalesce(json_agg(m.codigo order by m.ordem) filter (where m.codigo is not null), '[]') as modulos_liberados
from public.portal_roles r
left join public.portal_role_permissions rp on rp.role_id = r.id and rp.resource_id is null and rp.can_view = true
left join public.portal_modules m on m.id = rp.module_id
where r.codigo in ('suporte','admin','diretoria')
group by r.codigo, r.nome, r.is_admin
order by r.codigo;
