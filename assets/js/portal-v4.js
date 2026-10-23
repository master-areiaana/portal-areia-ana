(function(){
// Layout v4: só desenho. Login, sessão, permissões e links continuam no portal.js.
// A lista chega pronta (filtrada e corrigida) por window.PortalV4.desenhar(modules,resources).
const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const semAcento=(s)=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const svg=(d,w=20)=>`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// Ícones: os do padrão (aa-painel.js) e três desenhos próprios (calendário, casa, cadeado).
const IC={
  geral:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  grafico:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
  dinheiro:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  pessoa:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  ferramenta:'<path d="M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-2z"/>',
  lista:'<path d="M4 6h16M4 12h16M4 18h10"/>',
  calendario:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  casa:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cadeado:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};
const ICONE_AREA={indicadores:'grafico',comercial:'dinheiro',rh:'pessoa',sistemas:'ferramenta',calendario:'calendario',ativo:'casa',ativos:'casa',admin:'cadeado'};
const icArea=(codigo,w)=>svg(IC[ICONE_AREA[codigo]||'lista'],w);

const SUB_INICIO='Escolha uma área e clique para abrir o painel ou sistema aqui dentro.';
const st={areas:[],admin:null,tela:'inicio'};

// Tema: o portal.js segue usando body.light-mode e a chave portalTheme;
// aqui só espelhamos esse estado em <html data-theme>, que é o que o padrão v4 lê.
function espelharTema(){document.documentElement.setAttribute('data-theme',document.body.classList.contains('light-mode')?'light':'dark');}
espelharTema();
new MutationObserver(espelharTema).observe(document.body,{attributes:true,attributeFilter:['class']});

// O mesmo botão de tema fica no topo do login e vai para a barra de cima dentro do portal.
// A classe v4-dentro no body diz ao CSS qual das duas telas está à vista.
function posicionarTema(){const dentro=$('portal').style.display==='block';document.body.classList.toggle('v4-dentro',dentro);(dentro?$('v4TemaSlot'):$('v4Acoes')).appendChild($('themeToggle'));}
posicionarTema();
new MutationObserver(posicionarTema).observe($('portal'),{attributes:true,attributeFilter:['style']});

// Abrir: até a Fase 3 segue o target do cadastro. O log é o mesmo do portal.js, uma vez por clique.
function linkAbrir(r,classe,conteudo){return `<a class="${classe}" href="${esc(r.url)}" target="${esc(r.target||'_blank')}" data-v4-log="${esc(r.codigo)}" data-v4-titulo="${esc(r.titulo)}">${conteudo}</a>`;}
function linkFora(r){return `<a class="icone v4-fora" href="${esc(r.url)}" target="_blank" rel="noopener" data-v4-log="${esc(r.codigo)}" data-v4-titulo="${esc(r.titulo)}" title="Abrir em nova aba do navegador" aria-label="Abrir ${esc(r.titulo)} em nova aba do navegador">${svg(IC.ext,16)}</a>`;}
document.addEventListener('click',(e)=>{
  const a=e.target.closest('[data-v4-log]');
  if(!a||!$('portal').contains(a))return;
  window.PortalApp?.log('open_resource','portal_resources',null,{resource_code:a.dataset.v4Log,title:a.dataset.v4Titulo});
  fecharMenuCelular();
});

function desenharMenu(){
  const nav=(tela,ic,txt)=>`<button class="navlink v4-nv${st.tela===tela?' on':''}" type="button" data-v4-ir="${tela}" title="${esc(txt)}"><span class="nl">${ic}<span class="tx">${esc(txt)}</span></span></button>`;
  $('v4Menu').innerHTML=
    `<div class="navgrp"><span>Visão geral</span>${nav('inicio',svg(IC.geral,18),'Início')}</div>`+
    st.areas.map((a,i)=>`<div class="navgrp"><span>${i+1} · ${esc(a.m.nome)}</span>`+
      a.itens.map((r)=>linkAbrir(r,'navlink v4-nv',`<span class="nl">${icArea(a.m.codigo,18)}<span class="tx">${esc(r.titulo)}</span></span>`).replace('<a ',`<a title="${esc(r.titulo)}" `)).join('')+
    '</div>').join('')+
    (st.admin?`<div class="navgrp v4-grp-admin">${nav('admin',icArea('admin',18),st.admin.nome)}</div>`:'');
  $('v4Menu').querySelectorAll('[data-v4-ir]').forEach((b)=>b.onclick=()=>{ir(b.dataset.v4Ir);fecharMenuCelular();});
}

function desenharInicio(){
  $('v4Inicio').innerHTML=st.areas.map((a)=>`<section class="v4-area" data-v4-area>
    <div class="v4-area-hd"><h2>${esc(a.m.nome)}</h2><span data-v4-qtd>${a.itens.length} ${a.itens.length===1?'item':'itens'}</span></div>
    <div class="v4-grid">${a.itens.map((r)=>`<article class="v4-card" data-v4-card data-area="${esc(a.m.nome)}" data-titulo="${esc(r.titulo)}" data-url="${esc(r.url)}">
      <div class="v4-card-h"><span class="v4-badge">${icArea(a.m.codigo,20)}</span><div class="v4-nm">${esc(r.titulo)}</div></div>
      <div class="v4-card-ft">${r.subtitulo?`<span class="chip c-neutro">${esc(r.subtitulo)}</span>`:''}<span class="v4-sp"></span>${linkFora(r)}${linkAbrir(r,'btn btn-primary btn-sm v4-abrir','Abrir')}</div>
    </article>`).join('')||'<div class="empty-card">Nenhum recurso liberado nesta aba.</div>'}</div>
  </section>`).join('')+'<div class="v4-vazio" id="v4Vazio" hidden></div>';
  filtrar();
}

// Busca: só esconde cards na tela; não mexe na lista.
function filtrar(){
  const q=semAcento($('v4Busca').value.trim());
  let total=0;
  $('v4Inicio').querySelectorAll('[data-v4-area]').forEach((sec)=>{
    const cards=[...sec.querySelectorAll('[data-v4-card]')];
    let n=0;
    cards.forEach((c)=>{const ok=!q||semAcento(c.dataset.titulo).includes(q);c.hidden=!ok;if(ok)n++;});
    sec.hidden=Boolean(q)&&n===0;
    if(q)sec.querySelector('[data-v4-qtd]').textContent=`${n} de ${cards.length}`;
    else sec.querySelector('[data-v4-qtd]').textContent=`${cards.length} ${cards.length===1?'item':'itens'}`;
    total+=n;
  });
  const vazio=$('v4Vazio');
  if(vazio){vazio.hidden=!q||total>0;vazio.textContent=`Nenhum sistema encontrado para “${$('v4Busca').value.trim()}”.`;}
}

function desenharAbas(){
  const on=st.tela==='inicio'||st.tela==='vazio';
  $('v4Abas').innerHTML=`<div class="v4-aba${on?' on':''}"><button class="v4-abab" type="button" role="tab" aria-selected="${on}" data-v4-ir="inicio">${svg(IC.casa,15)}Início</button></div>`;
  if(st.tela!=='vazio')$('v4Abas').querySelectorAll('[data-v4-ir]').forEach((b)=>b.onclick=()=>ir(b.dataset.v4Ir));
}

// Telas: Início (cards) e Controle de Acessos (a tela atual do admin.js, aberta pelo botão de sempre).
function ir(tela){
  st.tela=tela;
  $('v4Inicio').classList.toggle('on',tela==='inicio');
  $('v4Admin').classList.toggle('on',tela==='admin');
  if(tela==='admin'){
    $('v4Titulo').textContent=st.admin?.nome||'Controle de Acessos';
    $('v4Sub').textContent=st.admin?.descricao||'';
    $('mainMenu').querySelector('[data-module="admin"]')?.click();
  }else{
    $('v4Titulo').textContent='Portal de Acessos';
    $('v4Sub').textContent=SUB_INICIO;
  }
  desenharMenu();
  desenharAbas();
}

function desenhar(modules,resources){
  st.admin=(modules||[]).find((m)=>m.codigo==='admin')||null;
  st.areas=(modules||[]).filter((m)=>m.codigo!=='admin').map((m)=>({m,itens:(resources||[]).filter((r)=>r.module_id===m.id)}));
  $('v4Busca').value='';
  desenharInicio();
  // Sem nenhuma área liberada, mostra o aviso que o portal.js já escreve.
  if(!(modules||[]).length){st.tela='vazio';$('v4Inicio').classList.remove('on');$('v4Admin').classList.add('on');desenharMenu();desenharAbas();return;}
  ir('inicio');
}

// Menu: seta recolhe (só ícones) no computador; no celular abre e fecha pelo ☰.
const celular=()=>window.innerWidth<900;
function fecharMenuCelular(){$('v4App').classList.remove('menu-aberto');}
$('v4Recolher').onclick=()=>{
  if(celular()){fecharMenuCelular();return;}
  const mini=$('v4App').classList.toggle('v4-mini');
  $('v4Recolher').setAttribute('aria-label',mini?'Abrir menu':'Recolher menu');
};
$('v4BtnMenu').onclick=()=>$('v4App').classList.add('menu-aberto');
// O fundo some ao fechar; o foco volta para o ☰ em vez de ficar num botão escondido.
$('v4Fundo').onclick=()=>{fecharMenuCelular();$('v4BtnMenu').focus();};
if(window.innerWidth<1600)$('v4App').classList.add('v4-mini');
$('v4Busca').addEventListener('input',()=>{if(st.tela!=='inicio'&&st.tela!=='vazio')ir('inicio');filtrar();});

window.PortalV4={desenhar};
})();
