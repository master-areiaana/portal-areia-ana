-- Corrige a resolução de permissões por usuário.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não altera Auth, não altera senhas, não apaga usuários.

-- Conceito:
-- portal_user_permissions com resource_id null e can_view=true deixa a aba visível.
-- can_open=true no nível da aba significa "aba inteira", liberando todos os cards da aba.
-- can_open=false no nível da aba significa apenas "mostrar a aba porque há card específico liberado".
-- Cards específicos continuam sendo controlados por resource_id.

create or replace function public.portal_can_access_resource(p_resource_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_role_id uuid;
  v_up record;
  v_rp record;
begin
  if auth.uid() is null or not public.portal_is_active() then
    return false;
  end if;

  if public.portal_is_admin() then
    return true;
  end if;

  select res.id, res.module_id
    into v_res
    from public.portal_resources res
    join public.portal_modules m on m.id = res.module_id
   where res.codigo = p_resource_code
     and res.ativo = true
     and m.ativo = true;

  if v_res is null then
    return false;
  end if;

  v_role_id := public.portal_current_role_id();

  -- 1) Regra específica do usuário para o card.
  select *
    into v_up
    from public.portal_user_permissions
   where user_id = auth.uid()
     and module_id = v_res.module_id
     and resource_id = v_res.id
     and (expires_at is null or expires_at > now())
   order by created_at desc
   limit 1;

  if found then
    return case
      when v_up.effect = 'deny' then false
      else coalesce(v_up.can_view, false)
    end;
  end if;

  -- 2) Regra do usuário para a aba.
  -- Deny bloqueia a aba toda.
  -- Allow com can_open=true libera a aba inteira, incluindo todos os cards.
  -- Allow com can_open=false só deixa a aba aparecer; não libera todos os cards.
  select *
    into v_up
    from public.portal_user_permissions
   where user_id = auth.uid()
     and module_id = v_res.module_id
     and resource_id is null
     and (expires_at is null or expires_at > now())
   order by created_at desc
   limit 1;

  if found then
    if v_up.effect = 'deny' then
      return false;
    end if;

    if coalesce(v_up.can_view, false) and coalesce(v_up.can_open, false) then
      return true;
    end if;
  end if;

  -- 3) Regra específica do perfil base para o card.
  select *
    into v_rp
    from public.portal_role_permissions
   where role_id = v_role_id
     and module_id = v_res.module_id
     and resource_id = v_res.id
   limit 1;

  if found then
    return coalesce(v_rp.can_view, false);
  end if;

  -- 4) Regra do perfil base para a aba inteira.
  select *
    into v_rp
    from public.portal_role_permissions
   where role_id = v_role_id
     and module_id = v_res.module_id
     and resource_id is null
   limit 1;

  if found then
    return coalesce(v_rp.can_view, false);
  end if;

  return false;
end;
$$;

create or replace function public.portal_can_access_module(p_module_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mod_id uuid;
  v_role_id uuid;
  v_up record;
  v_rp record;
  v_any boolean;
begin
  if auth.uid() is null or not public.portal_is_active() then
    return false;
  end if;

  if public.portal_is_admin() then
    return true;
  end if;

  select id
    into v_mod_id
    from public.portal_modules
   where codigo = p_module_code
     and ativo = true;

  if v_mod_id is null then
    return false;
  end if;

  v_role_id := public.portal_current_role_id();

  -- Regra direta do usuário para a aba.
  select *
    into v_up
    from public.portal_user_permissions
   where user_id = auth.uid()
     and module_id = v_mod_id
     and resource_id is null
     and (expires_at is null or expires_at > now())
   order by created_at desc
   limit 1;

  if found then
    if v_up.effect = 'deny' then
      return false;
    end if;

    if coalesce(v_up.can_view, false) then
      return true;
    end if;
  end if;

  -- Regra do perfil base para a aba.
  select *
    into v_rp
    from public.portal_role_permissions
   where role_id = v_role_id
     and module_id = v_mod_id
     and resource_id is null
   limit 1;

  if found and coalesce(v_rp.can_view, false) then
    return true;
  end if;

  -- Se existir qualquer card liberado, a aba deve aparecer.
  select exists (
    select 1
      from public.portal_resources r
     where r.module_id = v_mod_id
       and r.ativo = true
       and public.portal_can_access_resource(r.codigo)
  ) into v_any;

  return coalesce(v_any, false);
end;
$$;

grant execute on function public.portal_can_access_resource(text) to authenticated;
grant execute on function public.portal_can_access_module(text) to authenticated;

-- Diagnóstico do usuário Admin/Diretoria após a correção.
select public.portal_can_access_module('indicadores') as indicadores_module_visible;
