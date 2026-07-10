-- Permite que Admin/Diretoria gerencie acessos comuns do portal.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Nao altera Auth, nao altera senha, nao apaga usuarios.
-- A conta tecnica portalcore.consult@gmail.com continua protegida: Admin/Diretoria nao ve nem altera essa conta via RLS.

-- 1) Funcao auxiliar: quem pode usar Controle de Acessos operacional.
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

-- 2) Regras de profiles.
-- Suporte/is_admin continua vendo tudo.
-- Admin/Diretoria ve e altera usuarios comuns, mas nao a conta tecnica protegida.
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

-- 3) Perfis base: Admin/Diretoria precisa ler roles para preencher o select.
drop policy if exists portal_roles_select_admin on public.portal_roles;
create policy portal_roles_select_admin on public.portal_roles
for select
using (public.portal_is_admin() or public.portal_can_manage_access_control());

-- 4) Permissoes individuais: Admin/Diretoria pode gerir permissao dos usuarios comuns.
-- A conta tecnica protegida fica fora.
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

-- 5) Permissoes de perfil: Admin/Diretoria so precisa ler para a matriz mostrar heranca do perfil base.
drop policy if exists portal_role_permissions_admin_all on public.portal_role_permissions;
create policy portal_role_permissions_select_access_control on public.portal_role_permissions
for select
using (public.portal_is_admin() or public.portal_can_manage_access_control());

create policy portal_role_permissions_admin_all on public.portal_role_permissions
for all
using (public.portal_is_admin())
with check (public.portal_is_admin());

-- 6) A funcao de upsert usada pelo convite deve aceitar Admin/Diretoria tambem,
-- mas continuar bloqueando a conta tecnica protegida.
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

-- 7) Validacao: deve retornar linhas para admin/diretoria ativos e confirmar funcao criada.
select
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
where r.codigo in ('suporte', 'admin', 'diretoria')
order by r.codigo, p.nome;
