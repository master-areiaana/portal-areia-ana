-- =========================================================
-- Portal Areia Ana
-- Atualiza o card de Cobrança e adiciona Controle de Caixas
-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- Não altera autenticação, perfis, usuários ou permissões existentes.
-- =========================================================

begin;

-- Atualiza somente o endereço do recurso de Cobrança já existente.
update public.portal_resources
set
  url = 'https://master-areiaana.github.io/sistema-simplificado-cobranca/',
  target = '_self',
  updated_at = now()
where codigo = 'ind_cobranca';

-- Cria ou atualiza o card Controle de Caixas dentro da aba Indicadores.
insert into public.portal_resources (
  module_id,
  codigo,
  titulo,
  subtitulo,
  url,
  target,
  ordem,
  sensibilidade,
  ativo
)
select
  m.id,
  'ind_controle_caixas',
  'Controle de Caixas',
  'Planilha de controle',
  'https://docs.google.com/spreadsheets/d/1lFmIpjsUEi8UjPvzpbf0RAaweYZUcLruYft0QTNOD5w/edit?gid=1355465713#gid=1355465713',
  '_blank',
  9,
  'alta',
  true
from public.portal_modules m
where m.codigo = 'indicadores'
on conflict (codigo) do update set
  module_id = excluded.module_id,
  titulo = excluded.titulo,
  subtitulo = excluded.subtitulo,
  url = excluded.url,
  target = excluded.target,
  ordem = excluded.ordem,
  sensibilidade = excluded.sensibilidade,
  ativo = excluded.ativo,
  updated_at = now();

commit;

-- Conferência final.
select
  m.codigo as aba,
  r.codigo,
  r.titulo,
  r.url,
  r.target,
  r.ordem,
  r.ativo
from public.portal_resources r
join public.portal_modules m on m.id = r.module_id
where r.codigo in ('ind_cobranca', 'ind_controle_caixas')
order by r.ordem;
