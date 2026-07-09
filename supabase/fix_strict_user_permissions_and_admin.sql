-- Corrige definitivamente o modelo para permissão operacional por usuário.
-- Execute uma vez no Supabase SQL Editor do projeto portal-areia-ana.
-- Não altera Auth, não altera senhas, não apaga usuários.

-- Regra final:
-- 1) Suporte continua vendo tudo por is_admin=true.
-- 2) Usuários comuns, incluindo Admin/Diretoria, veem somente o que estiver em portal_user_permissions.
-- 3) Perfil base não libera acesso operacional.
-- 4) Módulo com can_view=true e can_open=false: mostra a aba, mas não libera todos os cards.
-- 5) Módulo com can_view=true e can_open=true: libera aba inteira e todos os cards.
-- 6) Resource/card específico com can_view=true: libera somente aquele card.

create or replace function public.portal_can_access_resource(p_resource_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_up record;
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

  -- Permissão específica do usuário para o card.
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

  -- Permissão do usuário para a aba inteira.
  -- Só libera todos os cards se can_open=true.
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
  v_up record;
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

  -- Permissão direta do usuário para a aba.
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

  -- Se existir qualquer card individual liberado, a aba aparece.
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

-- Recria permissões individuais do Admin/Diretoria para as abas normais.
-- Não libera Controle de Acessos.
do $$
declare
  v_user_id uuid;
begin
  select id
    into v_user_id
    from public.portal_profiles
   where lower(email) = 'areia.ana.gestao@gmail.com'
   limit 1;

  if v_user_id is null then
    raise notice 'Usuário areia.ana.gestao@gmail.com não encontrado em portal_profiles.';
    return;
  end if;

  delete from public.portal_user_permissions
   where user_id = v_user_id;

  -- Aba inteira para todos os módulos ativos, exceto Controle de Acessos.
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

  -- Cards específicos também liberados para deixar o estado explícito na matriz.
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

-- Conferência final do usuário Admin/Diretoria.
select
  p.nome,
  p.email,
  p.username,
  p.status,
  m.codigo as modulo,
  m.nome as modulo_nome,
  up.resource_id is null as aba_inteira,
  coalesce(r.titulo, 'ABA INTEIRA') as item,
  up.effect,
  up.can_view,
  up.can_open
from public.portal_user_permissions up
join public.portal_profiles p on p.id = up.user_id
join public.portal_modules m on m.id = up.module_id
left join public.portal_resources r on r.id = up.resource_id
where lower(p.email) = 'areia.ana.gestao@gmail.com'
order by m.ordem, up.resource_id is not null, r.ordem;
