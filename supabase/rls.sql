-- =========================================================
-- Portal Areia Ana - RLS + funções auxiliares
-- =========================================================
alter table public.portal_roles enable row level security;
alter table public.portal_modules enable row level security;
alter table public.portal_resources enable row level security;
alter table public.portal_profiles enable row level security;
alter table public.portal_role_permissions enable row level security;
alter table public.portal_user_permissions enable row level security;
alter table public.portal_audit_logs enable row level security;
alter table public.portal_approval_rules enable row level security;

create or replace function public.portal_is_admin()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select r.is_admin from public.portal_profiles p join public.portal_roles r on r.id = p.role_id where p.id = auth.uid()), false);
$$;

create or replace function public.portal_is_active()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select p.status = 'ativo' and (p.validade_acesso is null or p.validade_acesso >= current_date) from public.portal_profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.portal_current_role_id()
returns uuid language sql security definer set search_path = public as $$
  select role_id from public.portal_profiles where id = auth.uid();
$$;

create or replace function public.portal_can_access_resource(p_resource_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_res record; v_role_id uuid; v_up record; v_rp record;
begin
  if auth.uid() is null or not public.portal_is_active() then return false; end if;
  if public.portal_is_admin() then return true; end if;
  select res.id, res.module_id into v_res from public.portal_resources res join public.portal_modules m on m.id = res.module_id where res.codigo = p_resource_code and res.ativo = true and m.ativo = true;
  if v_res is null then return false; end if;
  v_role_id := public.portal_current_role_id();

  select * into v_up from public.portal_user_permissions where user_id = auth.uid() and module_id = v_res.module_id and resource_id = v_res.id and (expires_at is null or expires_at > now()) order by created_at desc limit 1;
  if found then return case when v_up.effect = 'deny' then false else coalesce(v_up.can_view, false) end; end if;

  select * into v_up from public.portal_user_permissions where user_id = auth.uid() and module_id = v_res.module_id and resource_id is null and (expires_at is null or expires_at > now()) order by created_at desc limit 1;
  if found then return case when v_up.effect = 'deny' then false else coalesce(v_up.can_view, false) end; end if;

  select * into v_rp from public.portal_role_permissions where role_id = v_role_id and module_id = v_res.module_id and resource_id = v_res.id limit 1;
  if found then return coalesce(v_rp.can_view, false); end if;

  select * into v_rp from public.portal_role_permissions where role_id = v_role_id and module_id = v_res.module_id and resource_id is null limit 1;
  if found then return coalesce(v_rp.can_view, false); end if;
  return false;
end;
$$;

create or replace function public.portal_can_access_module(p_module_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_mod_id uuid; v_role_id uuid; v_up record; v_rp record; v_any boolean;
begin
  if auth.uid() is null or not public.portal_is_active() then return false; end if;
  if public.portal_is_admin() then return true; end if;
  select id into v_mod_id from public.portal_modules where codigo = p_module_code and ativo = true;
  if v_mod_id is null then return false; end if;
  v_role_id := public.portal_current_role_id();

  select * into v_up from public.portal_user_permissions where user_id = auth.uid() and module_id = v_mod_id and resource_id is null and (expires_at is null or expires_at > now()) order by created_at desc limit 1;
  if found then if v_up.effect = 'deny' then return false; end if; if coalesce(v_up.can_view, false) then return true; end if; end if;

  select * into v_rp from public.portal_role_permissions where role_id = v_role_id and module_id = v_mod_id and resource_id is null limit 1;
  if found and coalesce(v_rp.can_view, false) then return true; end if;

  select exists (select 1 from public.portal_resources r where r.module_id = v_mod_id and r.ativo = true and public.portal_can_access_resource(r.codigo)) into v_any;
  return coalesce(v_any, false);
end;
$$;

create or replace function public.portal_get_my_context()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile jsonb; v_role jsonb; v_modules jsonb; v_resources jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('authenticated', false); end if;
  select to_jsonb(p) into v_profile from public.portal_profiles p where p.id = auth.uid();
  if v_profile is null then return jsonb_build_object('authenticated', true, 'profile', null); end if;
  select to_jsonb(r) into v_role from public.portal_roles r where r.id = (v_profile->>'role_id')::uuid;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.ordem), '[]'::jsonb) into v_modules from public.portal_modules m where m.ativo = true and (public.portal_is_admin() or public.portal_can_access_module(m.codigo));
  select coalesce(jsonb_agg(to_jsonb(res) order by res.ordem), '[]'::jsonb) into v_resources from public.portal_resources res join public.portal_modules m on m.id = res.module_id where res.ativo = true and m.ativo = true and (public.portal_is_admin() or public.portal_can_access_resource(res.codigo));
  return jsonb_build_object('authenticated', true, 'profile', v_profile, 'role', v_role, 'modules', v_modules, 'resources', v_resources);
end;
$$;

create or replace function public.portal_log_event(p_action text, p_entity_type text default null, p_entity_id uuid default null, p_details jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_headers jsonb;
begin
  begin v_headers := current_setting('request.headers', true)::jsonb; exception when others then v_headers := null; end;
  insert into public.portal_audit_logs(actor_user_id, action, entity_type, entity_id, details, ip_address, user_agent)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_details, v_headers->>'x-forwarded-for', v_headers->>'user-agent');
end;
$$;

create or replace function public.portal_admin_upsert_profile_by_email(p_email text, p_nome text, p_role_codigo text, p_status text default 'ativo', p_cargo text default null, p_area text default null, p_unidade text default null, p_gestor text default null, p_validade_acesso date default null, p_observacoes text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid; v_role_id uuid; v_profile public.portal_profiles%rowtype;
begin
  if not public.portal_is_admin() then raise exception 'Acesso negado: somente admin pode criar/atualizar profiles.'; end if;
  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then raise exception 'Usuário não encontrado no Supabase Auth. Crie primeiro em Authentication > Users.'; end if;
  select id into v_role_id from public.portal_roles where codigo = p_role_codigo;
  if v_role_id is null then raise exception 'Perfil não encontrado: %', p_role_codigo; end if;
  insert into public.portal_profiles (id, nome, email, role_id, status, cargo, area, unidade, gestor, validade_acesso, observacoes)
  values (v_user_id, p_nome, lower(p_email), v_role_id, p_status, p_cargo, p_area, p_unidade, p_gestor, p_validade_acesso, p_observacoes)
  on conflict (id) do update set nome=excluded.nome,email=excluded.email,role_id=excluded.role_id,status=excluded.status,cargo=excluded.cargo,area=excluded.area,unidade=excluded.unidade,gestor=excluded.gestor,validade_acesso=excluded.validade_acesso,observacoes=excluded.observacoes,updated_at=now()
  returning * into v_profile;
  perform public.portal_log_event('profile_upsert', 'portal_profiles', v_profile.id, jsonb_build_object('email', lower(p_email), 'role_codigo', p_role_codigo, 'status', p_status));
  return to_jsonb(v_profile);
end;
$$;

-- Usa UPDATE + INSERT em vez de ON CONFLICT parcial dentro do PL/pgSQL.
-- Isso evita erro de parsing no Supabase SQL Editor e mantém a mesma regra de upsert.
create or replace function public.portal_admin_set_role_permission(p_role_codigo text, p_module_codigo text, p_resource_codigo text default null, p_can_view boolean default false, p_can_open boolean default false, p_can_manage boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role_id uuid;
  v_module_id uuid;
  v_resource_id uuid;
begin
  if not public.portal_is_admin() then
    raise exception 'Acesso negado: somente admin pode alterar permissões.';
  end if;

  select id into v_role_id from public.portal_roles where codigo = p_role_codigo;
  select id into v_module_id from public.portal_modules where codigo = p_module_codigo;

  if v_role_id is null then
    raise exception 'Perfil não encontrado: %', p_role_codigo;
  end if;

  if v_module_id is null then
    raise exception 'Módulo não encontrado: %', p_module_codigo;
  end if;

  if p_resource_codigo is null or p_resource_codigo = '' then
    update public.portal_role_permissions
       set can_view = p_can_view,
           can_open = p_can_open,
           can_manage = p_can_manage
     where role_id = v_role_id
       and module_id = v_module_id
       and resource_id is null;

    if not found then
      insert into public.portal_role_permissions(role_id, module_id, resource_id, can_view, can_open, can_manage)
      values (v_role_id, v_module_id, null, p_can_view, p_can_open, p_can_manage);
    end if;
  else
    select id into v_resource_id
      from public.portal_resources
     where codigo = p_resource_codigo
       and module_id = v_module_id;

    if v_resource_id is null then
      raise exception 'Recurso não encontrado: %', p_resource_codigo;
    end if;

    update public.portal_role_permissions
       set can_view = p_can_view,
           can_open = p_can_open,
           can_manage = p_can_manage
     where role_id = v_role_id
       and module_id = v_module_id
       and resource_id = v_resource_id;

    if not found then
      insert into public.portal_role_permissions(role_id, module_id, resource_id, can_view, can_open, can_manage)
      values (v_role_id, v_module_id, v_resource_id, p_can_view, p_can_open, p_can_manage);
    end if;
  end if;

  perform public.portal_log_event('role_permission_set', 'portal_role_permissions', null, jsonb_build_object('role_codigo',p_role_codigo,'module_codigo',p_module_codigo,'resource_codigo',p_resource_codigo,'can_view',p_can_view));
end;
$$;

revoke all on function public.portal_get_my_context() from public;
revoke all on function public.portal_log_event(text, text, uuid, jsonb) from public;
revoke all on function public.portal_admin_upsert_profile_by_email(text, text, text, text, text, text, text, text, date, text) from public;
revoke all on function public.portal_admin_set_role_permission(text, text, text, boolean, boolean, boolean) from public;
grant execute on function public.portal_get_my_context() to authenticated;
grant execute on function public.portal_log_event(text, text, uuid, jsonb) to authenticated;
grant execute on function public.portal_admin_upsert_profile_by_email(text, text, text, text, text, text, text, text, date, text) to authenticated;
grant execute on function public.portal_admin_set_role_permission(text, text, text, boolean, boolean, boolean) to authenticated;

-- Policies idempotentes
drop policy if exists portal_profiles_select on public.portal_profiles;
drop policy if exists portal_profiles_insert_admin on public.portal_profiles;
drop policy if exists portal_profiles_update_admin on public.portal_profiles;
drop policy if exists portal_profiles_delete_admin on public.portal_profiles;
drop policy if exists portal_roles_select_admin on public.portal_roles;
drop policy if exists portal_roles_insert_admin on public.portal_roles;
drop policy if exists portal_roles_update_admin on public.portal_roles;
drop policy if exists portal_roles_delete_admin on public.portal_roles;
drop policy if exists portal_modules_select on public.portal_modules;
drop policy if exists portal_modules_insert_admin on public.portal_modules;
drop policy if exists portal_modules_update_admin on public.portal_modules;
drop policy if exists portal_modules_delete_admin on public.portal_modules;
drop policy if exists portal_resources_select on public.portal_resources;
drop policy if exists portal_resources_insert_admin on public.portal_resources;
drop policy if exists portal_resources_update_admin on public.portal_resources;
drop policy if exists portal_resources_delete_admin on public.portal_resources;
drop policy if exists portal_role_permissions_admin_all on public.portal_role_permissions;
drop policy if exists portal_user_permissions_admin_all on public.portal_user_permissions;
drop policy if exists portal_audit_logs_select_admin on public.portal_audit_logs;
drop policy if exists portal_approval_rules_admin_all on public.portal_approval_rules;

create policy portal_profiles_select on public.portal_profiles for select using (id = auth.uid() or public.portal_is_admin());
create policy portal_profiles_insert_admin on public.portal_profiles for insert with check (public.portal_is_admin());
create policy portal_profiles_update_admin on public.portal_profiles for update using (public.portal_is_admin()) with check (public.portal_is_admin());
create policy portal_profiles_delete_admin on public.portal_profiles for delete using (public.portal_is_admin());
create policy portal_roles_select_admin on public.portal_roles for select using (public.portal_is_admin());
create policy portal_roles_insert_admin on public.portal_roles for insert with check (public.portal_is_admin());
create policy portal_roles_update_admin on public.portal_roles for update using (public.portal_is_admin()) with check (public.portal_is_admin());
create policy portal_roles_delete_admin on public.portal_roles for delete using (public.portal_is_admin());
create policy portal_modules_select on public.portal_modules for select using (public.portal_is_admin() or (ativo = true and public.portal_can_access_module(codigo)));
create policy portal_modules_insert_admin on public.portal_modules for insert with check (public.portal_is_admin());
create policy portal_modules_update_admin on public.portal_modules for update using (public.portal_is_admin()) with check (public.portal_is_admin());
create policy portal_modules_delete_admin on public.portal_modules for delete using (public.portal_is_admin());
create policy portal_resources_select on public.portal_resources for select using (public.portal_is_admin() or (ativo = true and public.portal_can_access_resource(codigo)));
create policy portal_resources_insert_admin on public.portal_resources for insert with check (public.portal_is_admin());
create policy portal_resources_update_admin on public.portal_resources for update using (public.portal_is_admin()) with check (public.portal_is_admin());
create policy portal_resources_delete_admin on public.portal_resources for delete using (public.portal_is_admin());
create policy portal_role_permissions_admin_all on public.portal_role_permissions for all using (public.portal_is_admin()) with check (public.portal_is_admin());
create policy portal_user_permissions_admin_all on public.portal_user_permissions for all using (public.portal_is_admin()) with check (public.portal_is_admin());
create policy portal_audit_logs_select_admin on public.portal_audit_logs for select using (public.portal_is_admin());
create policy portal_approval_rules_admin_all on public.portal_approval_rules for all using (public.portal_is_admin()) with check (public.portal_is_admin());
