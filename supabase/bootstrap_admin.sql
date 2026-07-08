-- =========================================================
-- Portal Areia Ana - Bootstrap do usuário Suporte
-- Execute depois de:
-- 1) criar o usuário no Supabase Auth > Users
-- 2) executar schema.sql, rls.sql e seed.sql
-- Troque o e-mail abaixo pelo e-mail real do usuário de suporte, se necessário.
-- =========================================================

do $$
declare
  v_email text := 'portalcore.consult@gmail.com';
  v_nome text := 'Mariana Queiroz';
  v_user_id uuid;
  v_role_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception 'Usuário não encontrado no Supabase Auth. Crie primeiro em Authentication > Users: %', v_email;
  end if;

  select id into v_role_id
  from public.portal_roles
  where codigo = 'suporte';

  if v_role_id is null then
    raise exception 'Perfil suporte não encontrado. Execute seed.sql antes deste bootstrap.';
  end if;

  insert into public.portal_profiles (
    id, nome, email, role_id, status, cargo, area, unidade, observacoes
  ) values (
    v_user_id, v_nome, lower(v_email), v_role_id, 'ativo', 'Suporte', 'Administração', 'Areia Ana', 'Usuário de suporte criado/ajustado por bootstrap_admin.sql'
  )
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email,
    role_id = excluded.role_id,
    status = 'ativo',
    updated_at = now();
end $$;
