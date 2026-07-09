-- =========================================================
-- Portal Areia Ana - Schema inicial
-- Prefixo portal_ em todas as tabelas
-- =========================================================
create extension if not exists pgcrypto;

create table if not exists public.portal_roles (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_modules (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_resources (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.portal_modules(id) on delete cascade,
  codigo text not null unique,
  titulo text not null,
  subtitulo text,
  url text not null,
  target text not null default '_blank',
  ordem int not null default 0,
  ativo boolean not null default true,
  sensibilidade text not null default 'media' check (sensibilidade in ('baixa','media','alta','critica')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  cargo text,
  area text,
  unidade text,
  gestor text,
  status text not null default 'ativo' check (status in ('ativo','inativo','bloqueado','excluido')),
  role_id uuid references public.portal_roles(id),
  validade_acesso date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.portal_roles(id) on delete cascade,
  module_id uuid not null references public.portal_modules(id) on delete cascade,
  resource_id uuid references public.portal_resources(id) on delete cascade,
  can_view boolean not null default false,
  can_open boolean not null default false,
  can_manage boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.portal_modules(id) on delete cascade,
  resource_id uuid references public.portal_resources(id) on delete cascade,
  can_view boolean,
  can_open boolean,
  can_manage boolean,
  effect text not null default 'allow' check (effect in ('allow','deny')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_approval_rules (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  tipo text not null,
  role_id uuid references public.portal_roles(id),
  limite_valor numeric,
  limite_percentual numeric,
  requires_next_level boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_role_perm_module on public.portal_role_permissions (role_id, module_id) where resource_id is null;
create unique index if not exists uq_role_perm_resource on public.portal_role_permissions (role_id, module_id, resource_id) where resource_id is not null;
create unique index if not exists uq_user_perm_module on public.portal_user_permissions (user_id, module_id) where resource_id is null;
create unique index if not exists uq_user_perm_resource on public.portal_user_permissions (user_id, module_id, resource_id) where resource_id is not null;

create index if not exists idx_portal_resources_module on public.portal_resources(module_id);
create index if not exists idx_portal_profiles_role on public.portal_profiles(role_id);
create index if not exists idx_portal_role_perm_role_mod on public.portal_role_permissions(role_id, module_id);
create index if not exists idx_portal_user_perm_user_mod on public.portal_user_permissions(user_id, module_id);
create index if not exists idx_portal_audit_actor_date on public.portal_audit_logs(actor_user_id, created_at desc);

create or replace function public.portal_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_portal_roles_updated on public.portal_roles;
create trigger trg_portal_roles_updated before update on public.portal_roles for each row execute function public.portal_set_updated_at();
drop trigger if exists trg_portal_modules_updated on public.portal_modules;
create trigger trg_portal_modules_updated before update on public.portal_modules for each row execute function public.portal_set_updated_at();
drop trigger if exists trg_portal_resources_updated on public.portal_resources;
create trigger trg_portal_resources_updated before update on public.portal_resources for each row execute function public.portal_set_updated_at();
drop trigger if exists trg_portal_profiles_updated on public.portal_profiles;
create trigger trg_portal_profiles_updated before update on public.portal_profiles for each row execute function public.portal_set_updated_at();
drop trigger if exists trg_portal_approval_rules_updated on public.portal_approval_rules;
create trigger trg_portal_approval_rules_updated before update on public.portal_approval_rules for each row execute function public.portal_set_updated_at();
