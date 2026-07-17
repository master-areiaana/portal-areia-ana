-- =========================================================
-- Portal Areia Ana - Seed inicial
-- Perfis, módulos, cards e permissões padrão
-- =========================================================

insert into public.portal_roles (codigo, nome, descricao, is_admin) values
  ('suporte','Suporte','Acesso total técnico para criação de usuários, permissões, logs e controle de acessos.', true),
  ('admin','Admin / Diretoria','Acesso amplo ao portal, sem controle de usuários e permissões.', false),
  ('diretoria','Diretoria','Acesso amplo aos indicadores, sistemas e áreas gerenciais.', false),
  ('gestao','Gestão','Acesso gerencial sem administração de usuários.', false),
  ('comercial','Comercial','Acesso ao comercial, calendário e indicadores liberados.', false),
  ('cobranca','Cobrança','Acesso à cobrança, inadimplentes e calendário.', false),
  ('rh','RH','Acesso à área de RH e calendário.', false),
  ('operacional','Operacional','Acesso a sistemas e indicadores operacionais.', false),
  ('consulta','Consulta','Acesso somente aos recursos liberados.', false)
on conflict (codigo) do update set nome=excluded.nome, descricao=excluded.descricao, is_admin=excluded.is_admin, updated_at=now();

insert into public.portal_modules (codigo, nome, descricao, ordem, ativo) values
  ('indicadores','Indicadores','Painéis e indicadores corporativos.', 1, true),
  ('comercial','Comercial','Links e documentos da área comercial.', 2, true),
  ('rh','RH','Sistemas e acessos de recursos humanos.', 3, true),
  ('sistemas','Sistemas','Sistemas gerais e operacionais.', 4, true),
  ('calendario','Calendário','Agenda e planejamento corporativo.', 5, true),
  ('admin','Controle de Acessos','Administração de usuários e permissões.', 6, true)
on conflict (codigo) do update set nome=excluded.nome, descricao=excluded.descricao, ordem=excluded.ordem, ativo=excluded.ativo, updated_at=now();

insert into public.portal_resources (module_id, codigo, titulo, subtitulo, url, target, ordem, sensibilidade, ativo)
select m.id, v.codigo, v.titulo, v.subtitulo, v.url, v.target, v.ordem, v.sensibilidade, true
from (values
  ('indicadores','ind_remessas_usina','Remessas Usina','Power BI','https://app.powerbi.com/view?r=eyJrIjoiNjM2OGI4ZmEtOTc3Zi00NjgzLWE3MDUtYzk0NDBmMDAyN2Y2IiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',1,'media'),
  ('indicadores','ind_inadimplentes','Inadimplentes','Power BI','https://app.powerbi.com/view?r=eyJrIjoiM2Q3NzQ0ZDMtZjZmYy00MGJmLTg0NWYtNjU4YTlmMWUyMjUwIiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',2,'alta'),
  ('indicadores','ind_pedidos_agregados','Pedidos – Agregados','Power BI','https://app.powerbi.com/view?r=eyJrIjoiN2JlMzJiZjQtMTcyZS00ZDAyLWIwZDQtYjQxMzM1ZmM4YTE0IiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',3,'media'),
  ('indicadores','ind_gastos_retorno_bts','Gastos e Retorno BTs','Power BI','https://app.powerbi.com/view?r=eyJrIjoiMDlhYjhkNDktZWExNC00MTNhLTg2MDctZTYxOWIyZTNjMjM0IiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',4,'alta'),
  ('indicadores','ind_dre','DRE','Power BI','https://app.powerbi.com/view?r=eyJrIjoiYzVkMDVkNmEtNTVjOS00NTMzLTk1MjEtNDQ0NjY5ZDk4ZGE3IiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',5,'critica'),
  ('indicadores','ind_volume_carteira_usina','Volume de Carteira – Usina','Power BI','https://app.powerbi.com/view?r=eyJrIjoiYWI2N2FlYjgtODJhNi00ODZhLThjMDgtNTZlMGYyMjk4N2Y2IiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',6,'alta'),
  ('indicadores','ind_custo_km_hora','Custo por KM / Hora','Power BI','https://app.powerbi.com/view?r=eyJrIjoiOTQzNGRhNjQtYjNjZi00YTZjLTkxNzMtODc2MTUzZGQ0MWY5IiwidCI6ImNjYjc4MDg1LWRkNjMtNDM3Ny05MWRjLTQ4MjQ0MjRhYzViZiJ9','_blank',7,'media'),
  ('indicadores','ind_cobranca','Cobrança','Controle de Cobrança','https://master-areiaana.github.io/sistema-simplificado-cobranca/','_self',8,'alta'),
  ('indicadores','ind_controle_caixas','Controle de Caixas','Planilha de controle','https://docs.google.com/spreadsheets/d/1TFBoGNH5Y_m6j848ariKT6QxfiBg4E_X0tIRkscEIw0/edit?resourcekey=&gid=1730102927#gid=1730102927','_blank',9,'alta'),
  ('comercial','com_oport_anderson','Lista de Oportunidades – Anderson','ClickUp','https://sharing.clickup.com/9007105436/l/h/8cdv1cw-11213/9e63db75b1c3352','_blank',1,'media'),
  ('comercial','com_oport_alison','Lista de Oportunidades – Alison','ClickUp','https://sharing.clickup.com/9007105436/l/h/8cdv1cw-36453/eb523e88d6e9c38','_blank',2,'media'),
  ('comercial','com_carteira_alison','Carteira Alison','ClickUp','https://sharing.clickup.com/9007105436/l/h/8cdv1cw-30393/59ba2d5bd702322','_blank',3,'media'),
  ('comercial','com_carteira_anderson','Carteira Anderson','ClickUp','https://sharing.clickup.com/9007105436/l/h/8cdv1cw-24473/3aeab89b75124c2','_blank',4,'media'),
  ('comercial','com_carteira_geral','Carteira Geral Unificada','ClickUp','https://sharing.clickup.com/9007105436/l/h/8cdv1cw-12053/62f6757b0d8af35','_blank',5,'media'),
  ('comercial','com_metas_roteiro','Metas e Roteiro Comercial','ClickUp Docs','https://doc.clickup.com/9007105436/d/h/8cdv1cw-26593/7d97ad164ca76b9','_blank',6,'media'),
  ('rh','rh_ponto_mais','Ponto Mais','Controle de Ponto','https://superportal-empregador.vr.com.br/pontomais','_blank',1,'media'),
  ('rh','rh_gestor','RH Gestor','Sistema de RH','https://sistema.rhgestor.com.br/login?ReturnUrl=%2fPainel%2fIndexMaster','_blank',2,'alta'),
  ('sistemas','sis_cta_smart','CTA Smart','Abastecimento','https://ctasmart.com.br:8443/login','_blank',1,'media'),
  ('sistemas','sis_bubble_cargas','Bubble – Cargas','Sistema Interno','https://areiaana.bubbleapps.io/version-test/pg_administrativa','_blank',2,'media'),
  ('sistemas','sis_email_locaweb','E-mail Locaweb','Webmail','https://webmail-seguro.com.br/areiaana.com.br/','_blank',3,'media'),
  ('sistemas','sis_topcon_crm','Topcon CRM','Comercial Usina','https://areiaana-remote.topconsuite.app:20200/pages/auth/login','_blank',4,'media'),
  ('sistemas','sis_topcon_bi','Topcon BI','Dashboards','https://analytics.zoho.com/workspace/1762700000040012018','_blank',5,'media'),
  ('sistemas','sis_topcon_tech','Topcon Tech','Tecnologia','https://areiaana.topconsuite.app/','_blank',6,'media'),
  ('sistemas','sis_topcon_fleet','Topcon Fleet','Rastreadores','https://areiaana.rastrin.app/','_blank',7,'media'),
  ('sistemas','sis_cigam','Portais CIGAM','ERP CIGAM','https://anaareiasportais.cigam.cloud/','_blank',8,'media'),
  ('calendario','cal_corporativo','Calendário Corporativo – Areia Ana','Abrir agenda completa','https://master-areiaana.github.io/agenda-areia-ana/','_blank',1,'baixa'),
  ('calendario','cal_planejamento','Planejamento e Controle','ClickUp','https://sharing.clickup.com/9007105436/l/h/8cdv1cw-423/e9df70ac3196f4a','_blank',2,'baixa')
) as v(module_codigo, codigo, titulo, subtitulo, url, target, ordem, sensibilidade)
join public.portal_modules m on m.codigo = v.module_codigo
on conflict (codigo) do update set module_id=excluded.module_id,titulo=excluded.titulo,subtitulo=excluded.subtitulo,url=excluded.url,target=excluded.target,ordem=excluded.ordem,sensibilidade=excluded.sensibilidade,ativo=excluded.ativo,updated_at=now();

-- Este seed redefine apenas as permissões padrão dos perfis iniciais.
delete from public.portal_role_permissions rp
using public.portal_roles r
where rp.role_id = r.id
  and r.codigo in ('suporte','admin','diretoria','gestao','comercial','cobranca','rh','operacional','consulta');

-- Suporte: acesso total real, único perfil com Controle de Acessos.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, true
from public.portal_roles r
cross join public.portal_modules m
where r.codigo = 'suporte';

-- Admin / Diretoria (perfil legado): todas as abas principais, exceto Controle de Acessos.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo in ('indicadores','comercial','rh','sistemas','calendario')
where r.codigo = 'admin';

-- Diretoria: todas as abas principais, exceto Controle de Acessos.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo in ('indicadores','comercial','rh','sistemas','calendario')
where r.codigo = 'diretoria';

-- Gestão.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo in ('indicadores','comercial','sistemas','calendario')
where r.codigo = 'gestao';

-- Comercial.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo in ('comercial','calendario')
where r.codigo = 'comercial';

-- RH.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo in ('rh','calendario')
where r.codigo = 'rh';

-- Operacional.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, null, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo in ('sistemas','calendario')
where r.codigo = 'operacional';

-- Cobrança: acesso parcial por card.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, res.id, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo = 'indicadores'
join public.portal_resources res on res.module_id = m.id and res.codigo in ('ind_inadimplentes','ind_cobranca','ind_volume_carteira_usina')
where r.codigo = 'cobranca';

insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, res.id, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo = 'calendario'
join public.portal_resources res on res.module_id = m.id
where r.codigo = 'cobranca';

-- Operacional: indicadores operacionais parciais.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, res.id, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo = 'indicadores'
join public.portal_resources res on res.module_id = m.id and res.codigo in ('ind_remessas_usina','ind_pedidos_agregados','ind_custo_km_hora')
where r.codigo = 'operacional';

-- Consulta: somente calendário corporativo.
insert into public.portal_role_permissions (role_id, module_id, resource_id, can_view, can_open, can_manage)
select r.id, m.id, res.id, true, true, false
from public.portal_roles r
join public.portal_modules m on m.codigo = 'calendario'
join public.portal_resources res on res.module_id = m.id and res.codigo = 'cal_corporativo'
where r.codigo = 'consulta';
