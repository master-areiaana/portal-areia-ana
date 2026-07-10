-- Promove Admin / Diretoria para acesso operacional total, mantendo a conta tecnica protegida.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Nao altera Auth, nao altera senha, nao apaga usuarios.
-- Importante: NAO marca role admin como is_admin=true para nao burlar a protecao da conta tecnica.

-- Conta tecnica protegida:
-- portalcore.consult@gmail.com

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

-- 2) Mantem o suporte como is_admin=true e mantem admin como is_admin=false.
-- Isso evita que Admin/Diretoria burle as politicas que protegem portalcore.consult@gmail.com.
update public.portal_roles
   set is_admin = case
     when codigo = 'suporte' then true
     when codigo = 'admin' then false
     else is_admin
   end,
       updated_at = now()
 where codigo in ('suporte', 'admin');

-- 3) Garante que o usuario Admin/Diretoria principal esteja ativo, sem validade vencida e com username correto.
update public.portal_profiles
   set status = 'ativo',
       validade_acesso = null,
       username = 'areia.ana.gestao',
       updated_at = now()
 where lower(email) = 'areia.ana.gestao@gmail.com';

-- 4) Garante que Admin / Diretoria tem permissao operacional para todos os modulos/cards normais,
-- incluindo Controle de Acessos, mas sem transformar em is_admin tecnico.
delete from public.portal_user_permissions
where user_id in (
  select id from public.portal_profiles where lower(email) = 'areia.ana.gestao@gmail.com'
);

insert into public.portal_user_permissions
  (user_id, module_id, resource_id, effect, can_view, can_open, can_manage)
select
  p.id,
  m.id,
  null,
  'allow',
  true,
  true,
  true
from public.portal_profiles p
cross join public.portal_modules m
where lower(p.email) = 'areia.ana.gestao@gmail.com'
  and m.ativo = true;

insert into public.portal_user_permissions
  (user_id, module_id, resource_id, effect, can_view, can_open, can_manage)
select
  p.id,
  r.module_id,
  r.id,
  'allow',
  true,
  true,
  true
from public.portal_profiles p
cross join public.portal_resources r
join public.portal_modules m on m.id = r.module_id
where lower(p.email) = 'areia.ana.gestao@gmail.com'
  and r.ativo = true
  and m.ativo = true;

-- 5) Recria politicas de RLS para Controle de Acessos operacional.
-- Admin/Diretoria pode gerenciar usuarios comuns, mas nao a conta tecnica protegida.
create or replace function public.portal_can_manage_access_control()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select
      p.status = 'ativo'
      and (p.validade_acesso is null or p.validade_acesso >= current_date)
      and r.codigo in ('suporte', 'admin', 'diretoria')
    from public.portal_profiles p
    join public.portal_roles r on r.id = p.role_id
    where p.id = auth.uid()
  ), false);
$$;

grant execute on function public.portal_can_manage_access_control() to authenticated;

-- Profiles: suporte tecnico continua vendo tudo via portal_is_admin().
-- Admin/Diretoria ve e altera usuarios comuns, exceto a conta tecnica.
drop policy if exists portal_profiles_select on public.portal_profiles;
drop policy if exists portal_profiles_insert_admin on public.portal_profiles;
drop policy if exists portal_profiles_update_admin on public.portal_profiles;
drop policy if exists portal_profiles_delete_admin on public.portal_profiles;

create policy portal_profiles_select on public.portal_profiles
for select
using (
  id = auth.uid()
  or public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and lower(email) <> 'portalcore.consult@gmail.com'
  )
);

create policy portal_profiles_insert_admin on public.portal_profiles
for insert
with check (
  public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and lower(email) <> 'portalcore.consult@gmail.com'
  )
);

create policy portal_profiles_update_admin on public.portal_profiles
for update
using (
  public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and lower(email) <> 'portalcore.consult@gmail.com'
  )
)
with check (
  public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and lower(email) <> 'portalcore.consult@gmail.com'
  )
);

create policy portal_profiles_delete_admin on public.portal_profiles
for delete
using (
  public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and lower(email) <> 'portalcore.consult@gmail.com'
  )
);

-- Roles: Admin/Diretoria precisa ler perfis base para preencher selects.
drop policy if exists portal_roles_select_admin on public.portal_roles;
create policy portal_roles_select_admin on public.portal_roles
for select
using (public.portal_is_admin() or public.portal_can_manage_access_control());

-- Permissoes individuais: Admin/Diretoria pode gerir usuarios comuns, exceto a conta tecnica.
drop policy if exists portal_user_permissions_admin_all on public.portal_user_permissions;
create policy portal_user_permissions_admin_all on public.portal_user_permissions
for all
using (
  public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and user_id not in (
      select id from public.portal_profiles where lower(email) = 'portalcore.consult@gmail.com'
    )
  )
)
with check (
  public.portal_is_admin()
  or (
    public.portal_can_manage_access_control()
    and user_id not in (
      select id from public.portal_profiles where lower(email) = 'portalcore.consult@gmail.com'
    )
  )
);

-- Permissoes de perfil: Admin/Diretoria le para a matriz; alteracao completa segue restrita ao suporte tecnico/is_admin.
drop policy if exists portal_role_permissions_select_access_control on public.portal_role_permissions;
drop policy if exists portal_role_permissions_admin_all on public.portal_role_permissions;

create policy portal_role_permissions_select_access_control on public.portal_role_permissions
for select
using (public.portal_is_admin() or public.portal_can_manage_access_control());

create policy portal_role_permissions_admin_all on public.portal_role_permissions
for all
using (public.portal_is_admin())
with check (public.portal_is_admin());

-- Logs: Admin/Diretoria pode ler logs como parte do Controle de Acessos.
drop policy if exists portal_audit_logs_select_admin on public.portal_audit_logs;
create policy portal_audit_logs_select_admin on public.portal_audit_logs
for select
using (public.portal_is_admin() or public.portal_can_manage_access_control());

-- 6) Funcao de upsert usada pelo convite: aceita Admin/Diretoria, mas bloqueia a conta tecnica protegida.
create or replace function public.portal_admin_upsert_profile_by_email(
  p_email text,
  p_nome text,
  p_role_codigo text,
  p_status text default 'ativo',
  p_cargo text default null,
  p_area text default null,
  p_unidade text default null,
  p_gestor text default null,
  p_validade_acesso date default null,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_profile public.portal_profiles%rowtype;
begin
  if not public.portal_can_manage_access_control() then
    raise exception 'Acesso negado: usuario sem permissao para criar/atualizar profiles.';
  end if;

  if lower(p_email) = 'portalcore.consult@gmail.com' and not public.portal_is_admin() then
    raise exception 'A conta tecnica protegida nao pode ser alterada por este fluxo.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then
    raise exception 'Usuario nao encontrado no Supabase Auth. Crie primeiro em Authentication > Users.';
  end if;

  select id into v_role_id from public.portal_roles where codigo = p_role_codigo;
  if v_role_id is null then
    raise exception 'Perfil nao encontrado: %', p_role_codigo;
  end if;

  insert into public.portal_profiles
    (id, nome, email, role_id, status, cargo, area, unidade, gestor, validade_acesso, observacoes)
  values
    (v_user_id, p_nome, lower(p_email), v_role_id, p_status, p_cargo, p_area, p_unidade, p_gestor, p_validade_acesso, p_observacoes)
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email,
    role_id = excluded.role_id,
    status = excluded.status,
    cargo = excluded.cargo,
    area = excluded.area,
    unidade = excluded.unidade,
    gestor = excluded.gestor,
    validade_acesso = excluded.validade_acesso,
    observacoes = excluded.observacoes,
    updated_at = now()
  returning * into v_profile;

  perform public.portal_log_event(
    'profile_upsert',
    'portal_profiles',
    v_profile.id,
    jsonb_build_object('email', lower(p_email), 'role_codigo', p_role_codigo, 'status', p_status)
  );

  return to_jsonb(v_profile);
end;
$$;

grant execute on function public.portal_admin_upsert_profile_by_email(text, text, text, text, text, text, text, text, date, text) to authenticated;

-- 7) Validacao depois da alteracao.
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

select
  p.nome,
  p.email,
  m.codigo as modulo,
  coalesce(res.codigo, 'ABA_INTEIRA') as recurso,
  up.can_view,
  up.can_open,
  up.can_manage
from public.portal_user_permissions up
join public.portal_profiles p on p.id = up.user_id
join public.portal_modules m on m.id = up.module_id
left join public.portal_resources res on res.id = up.resource_id
where lower(p.email) = 'areia.ana.gestao@gmail.com'
order by m.ordem, up.resource_id is not null, res.ordem;

-- Esperado para Admin/Diretoria:
-- portal_roles.codigo='admin' continua is_admin=false.
-- areia.ana.gestao@gmail.com fica status=ativo, validade_acesso=null, username=areia.ana.gestao.
-- Admin recebe permissao individual total para modulos/cards.
-- portalcore.consult@gmail.com continua protegida pelas politicas e oculta no front-end.
