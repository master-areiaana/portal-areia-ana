(function(){
// Layout v4: só desenho. Login, sessão, permissões e links continuam no portal.js.
// A lista chega pronta (filtrada e corrigida) por window.PortalV4.desenhar(modules,resources).
const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const semAcento=(s)=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const svg=(d,w=20)=>`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// Sistemas que não abrem dentro do portal: "Abrir" vai direto para nova aba do navegador.
// Só muda a tela; o cadastro dos links não é tocado.
// Cada item é um host (vale para o site todo) ou o começo de um endereço (https://…).
const ABRIR_FORA=[
  'areiaana.bubbleapps.io',                // Bubble – Cargas: X-Frame-Options DENY
  'ctasmart.com.br',                       // CTA Smart: X-Frame-Options DENY
  'homolog.controle-ponto-proto.pages.dev',// Controle de Ponto: X-Frame-Options DENY
  'webmail-seguro.com.br',                 // E-mail Locaweb: X-Frame-Options SAMEORIGIN
  'superportal-empregador.vr.com.br',      // Ponto Mais: recusado dentro de iframe (teste no navegador)
  'https://master-areiaana.github.io/sistema-simplificado-cobranca/' // Cobrança: leva ao workers.dev, que tem frame-ancestors 'none'
];
const abreFora=(r)=>{try{const h=new URL(r.url).hostname;return ABRIR_FORA.some((x)=>x.startsWith('https://')?r.url.startsWith(x):(h===x||h.endsWith('.'+x)));}catch(e){return false;}};

// Ícones: os do padrão (aa-painel.js) e desenhos próprios (calendário, casa, cadeado e os da barra).
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
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  recarregar:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  cheia:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
};
const ICONE_AREA={indicadores:'grafico',comercial:'dinheiro',rh:'pessoa',sistemas:'ferramenta',calendario:'calendario',ativo:'casa',ativos:'casa',admin:'cadeado'};
const icArea=(codigo,w)=>svg(IC[ICONE_AREA[codigo]||'lista'],w);

const SUB_INICIO='Escolha uma área e clique para abrir o painel ou sistema aqui dentro.';
// tela: 'inicio', 'admin', 'vazio' ou 's:<codigo>' (sistema aberto em aba)
const st={areas:[],admin:null,tela:'inicio',res:{},abertos:[]};
const sel=(cod)=>`[data-v4-sys="${CSS.escape(cod)}"]`;

// Tema: o portal.js segue usando body.light-mode e a chave portalTheme;
// aqui só espelhamos esse estado em <html data-theme>, que é o que o padrão v4 lê.
function espelharTema(){document.documentElement.setAttribute('data-theme',document.body.classList.contains('light-mode')?'light':'dark');}
espelharTema();
new MutationObserver(espelharTema).observe(document.body,{attributes:true,attributeFilter:['class']});

// O mesmo botão de tema fica no topo do login e vai para a barra de cima dentro do portal.
// A classe v4-dentro no body diz ao CSS qual das duas telas está à vista.
// Ao voltar para o login (Sair ou sessão encerrada), as abas internas são fechadas.
function posicionarTema(){const dentro=$('portal').style.display==='block';document.body.classList.toggle('v4-dentro',dentro);(dentro?$('v4TemaSlot'):$('v4Acoes')).appendChild($('themeToggle'));if(!dentro)fecharTodas();}
posicionarTema();
new MutationObserver(posicionarTema).observe($('portal'),{attributes:true,attributeFilter:['style']});

// Log: o mesmo do portal.js, uma vez por abertura (nunca ao trocar de aba ou recarregar).
function logAbrir(r){window.PortalApp?.log('open_resource','portal_resources',null,{resource_code:r.codigo,title:r.titulo});}
// ↗ e "Abrir em nova aba": o mesmo endereço do cadastro, em nova aba do navegador.
function linkFora(r,classe,conteudo,rotulo){return `<a class="${classe}" href="${esc(r.url)}" target="_blank" rel="noopener" data-v4-log="${esc(r.codigo)}" title="Abrir em nova aba do navegador" aria-label="${esc(rotulo||'Abrir '+r.titulo+' em nova aba do navegador')}">${conteudo}</a>`;}
document.addEventListener('click',(e)=>{
  const a=e.target.closest('[data-v4-log]');
  if(a&&$('portal').contains(a)){const r=st.res[a.dataset.v4Log];if(r)logAbrir(r);fecharMenuCelular();return;}
  const b=e.target.closest('[data-v4-abrir]');
  if(b&&$('portal').contains(b)){abrir(b.dataset.v4Abrir);fecharMenuCelular();}
});

// ---------- abrir / fechar sistemas em abas internas ----------
function abrir(cod){
  const r=st.res[cod];if(!r)return;
  if(abreFora(r)){window.open(r.url,'_blank','noopener');logAbrir(r);return;}
  if(!st.abertos.includes(cod)){st.abertos.push(cod);criarView(r);logAbrir(r);}
  ir('s:'+cod);
}
function fechar(cod){
  const i=st.abertos.indexOf(cod);if(i<0)return;
  st.abertos.splice(i,1);
  $('v4Palco').querySelector(sel(cod))?.remove();
  if(st.tela==='s:'+cod){const viz=st.abertos[Math.max(0,i-1)];ir(viz?'s:'+viz:'inicio');}else ir(st.tela);
}
function fecharTodas(){
  st.abertos=[];
  $('v4Palco').querySelectorAll('[data-v4-sys]').forEach((v)=>v.remove());
  sairTelaCheia();
}
// "Sair": fecha as abas antes do logout de sempre (o clique segue para o portal.js).
$('logoutBtn').addEventListener('click',fecharTodas,true);

// Cada sistema tem sua própria view com iframe: trocar de aba só esconde, não recarrega.
function criarView(r){
  const v=document.createElement('section');
  v.className='v4-view v4-sys';v.dataset.v4Sys=r.codigo;v.setAttribute('aria-label',r.titulo);
  v.innerHTML=`<div class="v4-sys-barra">
      <nav class="v4-crumb" aria-label="Caminho"><button type="button" data-v4-ir="inicio">Início</button> › <button type="button" data-v4-ir="area:${esc(r._areaCod)}">${esc(r._area)}</button> › <b>${esc(r.titulo)}</b></nav>
      <div class="v4-sys-acoes">
        <button class="btn btn-ghost btn-sm" type="button" data-v4-recarregar title="Recarregar">${svg(IC.recarregar,15)}<span class="v4-rot">Recarregar</span></button>
        <button class="btn btn-ghost btn-sm" type="button" data-v4-cheia title="Tela cheia">${svg(IC.cheia,15)}<span class="v4-rot">Tela cheia</span></button>
        ${linkFora(r,'btn btn-ghost btn-sm',svg(IC.ext,15)+'<span class="v4-rot">Abrir em nova aba</span>','Abrir em nova aba do navegador')}
        <button class="btn btn-ghost btn-sm" type="button" data-v4-fechar title="Fechar">${svg(IC.x,15)}<span class="v4-rot">Fechar</span></button>
      </div>
    </div>
    <div class="v4-moldura"><iframe src="${esc(r.url)}" title="${esc(r.titulo)}" allow="fullscreen; clipboard-read; clipboard-write"></iframe></div>`;
  v.querySelectorAll('.v4-crumb [data-v4-ir]').forEach((b)=>b.onclick=()=>ir(b.dataset.v4Ir));
  v.querySelector('[data-v4-fechar]').onclick=()=>fechar(r.codigo);
  v.querySelector('[data-v4-recarregar]').onclick=()=>{const f=v.querySelector('iframe');f.src=f.src;};
  v.querySelector('[data-v4-cheia]').onclick=()=>{$('v4App').classList.contains('v4-cheia')?sairTelaCheia():entrarTelaCheia();};
  $('v4Palco').appendChild(v);
}
function rotuloCheia(on){$('v4Palco').querySelectorAll('[data-v4-cheia]').forEach((b)=>{b.title=on?'Sair da tela cheia':'Tela cheia';b.querySelector('span').textContent=b.title;});}
function entrarTelaCheia(){$('v4App').classList.add('v4-cheia');rotuloCheia(true);}
function sairTelaCheia(){$('v4App').classList.remove('v4-cheia');rotuloCheia(false);}
document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&$('v4App').classList.contains('v4-cheia'))sairTelaCheia();});

// ---------- desenho ----------
function botaoAbrir(r,classe,conteudo){
  const fora=abreFora(r);
  return `<button class="${classe}" type="button" data-v4-abrir="${esc(r.codigo)}" title="${fora?'Este sistema não abre dentro do portal; abre em nova aba do navegador':esc(r.titulo)}">${conteudo}${fora&&classe.includes('v4-abrir')?svg(IC.ext,14):''}</button>`;
}

// Área da tela atual: a própria área ou a área do sistema aberto.
function areaAtual(){if(st.tela.startsWith('area:'))return st.tela.slice(5);if(st.tela.startsWith('s:'))return st.res[st.tela.slice(2)]?._areaCod;return null;}
const qtdItens=(n)=>`${n} ${n===1?'item':'itens'}`;
const abertosDaArea=(a)=>a.itens.filter((r)=>st.abertos.includes(r.codigo)).length;

// Menu: só as áreas, numeradas. Os sistemas aparecem no meio ao escolher a área.
function desenharMenu(){
  const atual=areaAtual();
  const nav=(tela,on,ic,txt,extra='')=>`<button class="navlink v4-nv${on?' on':''}" type="button" data-v4-ir="${tela}" title="${esc(txt)}"><span class="nl">${ic}<span class="tx">${esc(txt)}</span></span>${extra}</button>`;
  $('v4Menu').innerHTML=
    `<div class="navgrp"><span>Visão geral</span>${nav('inicio',st.tela==='inicio',svg(IC.geral,18),'Início')}</div>`+
    (st.areas.length?`<div class="navgrp"><span>Áreas</span>`+st.areas.map((a,i)=>nav('area:'+a.m.codigo,atual===a.m.codigo,icArea(a.m.codigo,18),`${i+1} · ${a.m.nome}`,
      (abertosDaArea(a)?'<span class="v4-dot" aria-label="sistema aberto"></span>':'')+`<span class="v4-nqtd">${a.itens.length}</span>`)).join('')+'</div>':'')+
    (st.admin?`<div class="navgrp v4-grp-admin">${nav('admin',st.tela==='admin',icArea('admin',18),st.admin.nome)}</div>`:'');
  $('v4Menu').querySelectorAll('[data-v4-ir]').forEach((b)=>b.onclick=()=>{ir(b.dataset.v4Ir);fecharMenuCelular();});
}

// Início: um bloco por área. Os cards de todas as áreas ficam na página e só a área escolhida aparece.
function desenharInicio(){
  $('v4Inicio').innerHTML=`<div class="v4-grid v4-blocos" id="v4Blocos">${st.areas.map((a,i)=>`<button class="v4-bloco" type="button" data-v4-ir="area:${esc(a.m.codigo)}">
      <span class="v4-badge">${icArea(a.m.codigo,22)}</span>
      <span class="v4-bloco-tx"><b>${i+1} · ${esc(a.m.nome)}</b><span>${qtdItens(a.itens.length)}<span class="v4-bloco-abertos" data-v4-abertos="${esc(a.m.codigo)}" hidden></span></span></span>
    </button>`).join('')}</div>`+
  st.areas.map((a)=>`<section class="v4-area" data-v4-area="${esc(a.m.codigo)}">
    <div class="v4-area-hd"><h2>${esc(a.m.nome)}</h2><span data-v4-qtd>${qtdItens(a.itens.length)}</span></div>
    <div class="v4-grid">${a.itens.map((r)=>`<article class="v4-card" data-v4-card data-codigo="${esc(r.codigo)}" data-area="${esc(a.m.nome)}" data-titulo="${esc(r.titulo)}" data-url="${esc(r.url)}">
      <div class="v4-card-h"><span class="v4-badge">${icArea(a.m.codigo,20)}</span><div class="v4-nm">${esc(r.titulo)}</div><span class="chip c-laranja v4-chip-aberto" hidden>Aberto</span></div>
      <div class="v4-card-ft">${r.subtitulo?`<span class="chip c-neutro">${esc(r.subtitulo)}</span>`:''}<span class="v4-sp"></span>${linkFora(r,'icone v4-fora',svg(IC.ext,16))}${botaoAbrir(r,'btn btn-primary btn-sm v4-abrir','Abrir')}</div>
    </article>`).join('')||'<div class="empty-card">Nenhum recurso liberado nesta aba.</div>'}</div>
  </section>`).join('')+'<div class="v4-vazio" id="v4Vazio" hidden></div>';
  $('v4Blocos').querySelectorAll('[data-v4-ir]').forEach((b)=>b.onclick=()=>ir(b.dataset.v4Ir));
  filtrar();
}
function marcarAbertos(){
  $('v4Inicio').querySelectorAll('[data-v4-card]').forEach((c)=>{c.querySelector('.v4-chip-aberto').hidden=!st.abertos.includes(c.dataset.codigo);});
  st.areas.forEach((a)=>{const el=$('v4Blocos')?.querySelector(`[data-v4-abertos="${CSS.escape(a.m.codigo)}"]`);if(!el)return;const n=abertosDaArea(a);el.hidden=!n;el.textContent=n===1?' · 1 aberto':` · ${n} abertos`;});
}

// O que aparece no meio: os blocos (Início), a área escolhida ou o resultado da busca em todas as áreas.
// A busca só esconde cards na tela; não mexe na lista.
function filtrar(){
  const q=semAcento($('v4Busca').value.trim());
  const area=st.tela.startsWith('area:')?st.tela.slice(5):null;
  $('v4Blocos').hidden=Boolean(q)||st.tela!=='inicio';
  let total=0;
  $('v4Inicio').querySelectorAll('[data-v4-area]').forEach((sec)=>{
    const cards=[...sec.querySelectorAll('[data-v4-card]')];
    let n=0;
    cards.forEach((c)=>{const ok=!q||semAcento(c.dataset.titulo).includes(q);c.hidden=!ok;if(ok)n++;});
    sec.hidden=q?n===0:sec.dataset.v4Area!==area;
    // na área escolhida o título já está na barra de cima; o cabeçalho só aparece na busca
    sec.querySelector('.v4-area-hd').hidden=!q;
    sec.querySelector('[data-v4-qtd]').textContent=q?`${n} de ${cards.length}`:qtdItens(cards.length);
    total+=n;
  });
  const vazio=$('v4Vazio');
  if(vazio){vazio.hidden=!q||total>0;vazio.textContent=`Nenhum sistema encontrado para “${$('v4Busca').value.trim()}”.`;}
}

function desenharAbas(){
  const inicioOn=st.tela==='inicio'||st.tela==='vazio'||st.tela.startsWith('area:');
  $('v4Abas').innerHTML=`<div class="v4-aba${inicioOn?' on':''}"><button class="v4-abab" type="button" role="tab" aria-selected="${inicioOn}" data-v4-ir="inicio">${svg(IC.casa,15)}Início</button></div>`+
    st.abertos.map((cod)=>{const r=st.res[cod],on=st.tela==='s:'+cod;return `<div class="v4-aba${on?' on':''}" data-v4-aba="${esc(cod)}">
      <button class="v4-abab" type="button" role="tab" aria-selected="${on}" data-v4-ir="s:${esc(cod)}" title="${esc(r.titulo)}">${esc(r.titulo)}</button>
      <button class="v4-abax" type="button" aria-label="Fechar ${esc(r.titulo)}" data-v4-x="${esc(cod)}">${svg(IC.x,14)}</button></div>`;}).join('');
  if(st.tela!=='vazio')$('v4Abas').querySelectorAll('[data-v4-ir]').forEach((b)=>b.onclick=()=>ir(b.dataset.v4Ir));
  $('v4Abas').querySelectorAll('[data-v4-x]').forEach((b)=>b.onclick=()=>fechar(b.dataset.v4X));
  // botão do meio do mouse na aba também fecha
  $('v4Abas').querySelectorAll('[data-v4-aba]').forEach((a)=>a.onauxclick=(e)=>{if(e.button===1)fechar(a.dataset.v4Aba);});
  $('v4Abas').querySelector('.v4-aba.on')?.scrollIntoView({block:'nearest',inline:'nearest'});
}

// Telas: Início (blocos das áreas), uma área (cards), Controle de Acessos (a tela atual do admin.js,
// aberta pelo botão de sempre) e sistemas abertos.
function ir(tela){
  st.tela=tela;
  const cod=tela.startsWith('s:')?tela.slice(2):null;
  const area=tela.startsWith('area:')?st.areas.find((a)=>a.m.codigo===tela.slice(5)):null;
  $('v4Inicio').classList.toggle('on',tela==='inicio'||Boolean(area));
  $('v4Admin').classList.toggle('on',tela==='admin'||tela==='vazio');
  $('v4Palco').querySelectorAll('[data-v4-sys]').forEach((v)=>v.classList.toggle('on',v.dataset.v4Sys===cod));
  if(cod){
    const r=st.res[cod];
    $('v4Titulo').textContent=r.titulo;
    $('v4Sub').textContent=[r._area,r.subtitulo].filter(Boolean).join(' · ');
  }else if(area){
    $('v4Titulo').textContent=area.m.nome;
    $('v4Sub').textContent=[area.m.descricao,qtdItens(area.itens.length)].filter(Boolean).join(' · ');
  }else if(tela==='admin'){
    $('v4Titulo').textContent=st.admin?.nome||'Controle de Acessos';
    $('v4Sub').textContent=st.admin?.descricao||'';
    $('mainMenu').querySelector('[data-module="admin"]')?.click();
  }else{
    $('v4Titulo').textContent='Portal de Acessos';
    $('v4Sub').textContent=SUB_INICIO;
  }
  if(!cod)sairTelaCheia();
  $('v4Qtd').textContent=st.abertos.length+(st.abertos.length===1?' aberto':' abertos');
  if($('v4Blocos'))filtrar();
  marcarAbertos();
  desenharMenu();
  desenharAbas();
}

function desenhar(modules,resources){
  fecharTodas();
  st.admin=(modules||[]).find((m)=>m.codigo==='admin')||null;
  st.areas=(modules||[]).filter((m)=>m.codigo!=='admin').map((m)=>({m,itens:(resources||[]).filter((r)=>r.module_id===m.id)}));
  // índice por código só para a tela (o nome da área vai junto para o caminho "Início › Área › Sistema")
  st.res={};
  st.areas.forEach((a)=>a.itens.forEach((r)=>{st.res[r.codigo]=Object.assign(Object.create(r),{_area:a.m.nome,_areaCod:a.m.codigo});}));
  $('v4Busca').value='';
  desenharInicio();
  // Sem nenhuma área liberada, mostra o aviso que o portal.js já escreve.
  if(!(modules||[]).length){ir('vazio');return;}
  ir('inicio');
}

// ---------- menu: seta recolhe (só ícones) no computador; no celular abre e fecha pelo ☰ ----------
const CHAVE_MENU='portalV4Menu';
const celular=()=>window.innerWidth<900;
function fecharMenuCelular(){$('v4App').classList.remove('menu-aberto');}
$('v4Recolher').onclick=()=>{
  if(celular()){fecharMenuCelular();return;}
  const mini=$('v4App').classList.toggle('v4-mini');
  $('v4Recolher').setAttribute('aria-label',mini?'Abrir menu':'Recolher menu');
  try{localStorage.setItem(CHAVE_MENU,mini?'recolhido':'aberto');}catch(e){}
};
$('v4BtnMenu').onclick=()=>$('v4App').classList.add('menu-aberto');
// O fundo some ao fechar; o foco volta para o ☰ em vez de ficar num botão escondido.
$('v4Fundo').onclick=()=>{fecharMenuCelular();$('v4BtnMenu').focus();};
let escolhaMenu=null;
try{escolhaMenu=localStorage.getItem(CHAVE_MENU);}catch(e){}
const comecaRecolhido=escolhaMenu==='recolhido'||escolhaMenu==='aberto'?escolhaMenu==='recolhido':window.innerWidth<1280;
$('v4App').classList.toggle('v4-mini',comecaRecolhido);
$('v4Recolher').setAttribute('aria-label',comecaRecolhido?'Abrir menu':'Recolher menu');
// Busca em todas as áreas; de um sistema aberto ou do Controle de Acessos, volta para o meio com os cards.
$('v4Busca').addEventListener('input',()=>{if(st.tela.startsWith('s:')||st.tela==='admin')ir('inicio');else filtrar();});

window.PortalV4={desenhar};
})();
