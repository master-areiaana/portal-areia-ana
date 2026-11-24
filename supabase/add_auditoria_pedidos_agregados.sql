-- Adiciona a auditoria ao catálogo de Indicadores usando as permissões existentes.
insert into public.portal_resources (
  module_id, codigo, titulo, subtitulo, url, target, ordem, sensibilidade, ativo
)
select
  m.id,
  'ind_auditoria_pedidos_agregados',
  'Auditoria de Pedidos – Agregados',
  'Auditoria de pedidos',
  'https://auditoria-pedidos-agregados.pages.dev/#geral',
  '_blank',
  11,
  'alta',
  true
from public.portal_modules m
where m.codigo = 'indicadores'
  and m.ativo
  and not exists (
    select 1
    from public.portal_resources r
    where r.module_id = m.id
      and rtrim(split_part(r.url, '#', 1), '/') = 'https://auditoria-pedidos-agregados.pages.dev'
  )
on conflict (codigo) do nothing;
