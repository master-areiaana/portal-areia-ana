(function(){
'use strict';
// =====================================================================
// Documentos — tela do portal que conversa com o Apps Script (Web App).
// O portal NÃO acessa o Drive: só manda o pedido + o token do login do portal.
// O Apps Script confere o login no Supabase e só então lê/grava na pasta fechada.
// Nenhuma chave aqui. A URL do Web App sozinha não dá acesso a nada.
// =====================================================================
const URL_WEBAPP='';

const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const svg=(d,w=18)=>`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const MB=1024*1024;

const IC={
  subir:'<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pasta:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  novaPasta:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v6M9 13.5h6"/>',
  busca:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  atualizar:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  ajuda:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6M12 17h.01"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  abrir:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  baixar:'<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  lixo:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  arquivo:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>'
};

const st={
  pronto:false, pastaId:'', caminho:[{id:'',nome:'Raiz'}], pastas:[], arquivos:[],
  busca:null, limiteMb:20, usuario:null, pedido:0,
  fila:[], enviando:false
};

// ---------- tema: acompanha o portal (localStorage portalTheme) ----------
function aplicarTema(){let t=null;try{t=localStorage.getItem('portalTheme');}catch(e){}document.body.classList.toggle('aa-escuro',t!=='light');}
window.addEventListener('storage',(e)=>{if(e.key==='portalTheme')aplicarTema();});

// ---------- comunicação com o Apps Script ----------
function falha(status,msg){const e=new Error(msg);e.status=status;return e;}
async function token(){
  let s=null;
  try{s=await window.PortalAuth.getSession();}catch(e){}
  if(!s||!s.access_token)throw falha(401,'Sua sessão terminou. Entre no portal novamente.');
  return s.access_token;
}
// text/plain e sem cabeçalhos próprios: evita o preflight de CORS (o Apps Script não responde OPTIONS).
async function api(acao,campos){
  if(!URL_WEBAPP)throw falha(0,'O módulo Documentos ainda não foi ligado ao Google Drive.');
  const corpo=JSON.stringify(Object.assign({},campos||{},{acao,token:await token()}));
  let r;
  try{r=await fetch(URL_WEBAPP,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:corpo,redirect:'follow',credentials:'omit',cache:'no-store'});}
  catch(e){throw falha(0,'Falha de rede. Confira a internet e tente de novo.');}
  let d;
  try{d=await r.json();}catch(e){throw falha(r.status||502,'O servidor de documentos não respondeu como esperado. Tente de novo.');}
  if(!d||!d.ok)throw falha((d&&d.status)||500,(d&&d.erro)||'Não foi possível concluir.');
  return d.dados;
}

// ---------- avisos ----------
let tempoAviso=null;
function aviso(msg,tipo='erro',extraHtml=''){
  const el=$('docAviso');
  clearTimeout(tempoAviso);
  el.className='doc-aviso doc-'+tipo;
  el.innerHTML=`<span>${esc(msg)}</span>${extraHtml}<button type="button" class="doc-aviso-x" aria-label="Fechar aviso">${svg(IC.x,14)}</button>`;
  el.hidden=false;
  el.querySelector('.doc-aviso-x').onclick=()=>{el.hidden=true;};
  if(tipo==='ok')tempoAviso=setTimeout(()=>{el.hidden=true;},5000);
}
function mostrarErro(e){
  if(e&&e.status===401){
    aviso(e.message||'Sua sessão terminou. Entre no portal novamente.','erro',' <a class="aa-btn" href="./" target="_top">Entrar no portal</a>');
  }else{
    aviso((e&&e.message)||'Não foi possível concluir.','erro');
  }
}

// ---------- formatos ----------
function tamanho(n){
  n=Number(n)||0;
  if(!n)return '—';
  if(n<1024)return n+' B';
  if(n<MB)return (n/1024).toLocaleString('pt-BR',{maximumFractionDigits:0})+' KB';
  return (n/MB).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';
}
function data(iso){
  if(!iso)return '—';
  const d=new Date(iso);if(isNaN(d))return '—';
  return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function autor(email){return email?String(email).split('@')[0]:'—';}

// Tipo do arquivo → ícone e rótulo
function tipoDe(mime,nome){
  const m=String(mime||'').toLowerCase();
  const ext=(String(nome||'').match(/\.([a-z0-9]{1,5})$/i)||[])[1]||'';
  const e=ext.toLowerCase();
  if(m==='pasta')return{k:'pasta',r:''};
  if(m==='application/pdf'||e==='pdf')return{k:'pdf',r:'PDF'};
  if(m.startsWith('image/')||/^(jpe?g|png|gif|webp|heic|bmp|svg)$/.test(e))return{k:'img',r:'IMG'};
  if(/spreadsheet|excel|csv/.test(m)||/^(xlsx?|xlsm|csv|ods)$/.test(e))return{k:'xls',r:e?e.toUpperCase().slice(0,4):'XLS'};
  if(/presentation|powerpoint/.test(m)||/^(pptx?|odp)$/.test(e))return{k:'ppt',r:'PPT'};
  if(/wordprocessing|msword|google-apps\.document|opendocument\.text/.test(m)||/^(docx?|odt|rtf)$/.test(e))return{k:'doc',r:'DOC'};
  if(/zip|rar|7z|tar|gzip/.test(m)||/^(zip|rar|7z|gz)$/.test(e))return{k:'zip',r:'ZIP'};
  if(m.startsWith('video/'))return{k:'vid',r:'VÍD'};
  if(m.startsWith('audio/'))return{k:'aud',r:'ÁUD'};
  if(m.startsWith('text/')||e==='txt')return{k:'txt',r:'TXT'};
  return{k:'arq',r:e?e.toUpperCase().slice(0,4):''};
}
function icone(t){
  if(t.k==='pasta')return `<span class="doc-ic doc-t-pasta">${svg(IC.pasta,22)}</span>`;
  return `<span class="doc-ic doc-t-${t.k}">${svg(IC.arquivo,22)}${t.r?`<i>${esc(t.r)}</i>`:''}</span>`;
}
// Abre numa aba nova só o que o navegador mostra sozinho e é seguro (pelo TIPO real, não pelo nome):
// PDF, imagem comum e texto puro. HTML, SVG e o resto são sempre baixados (não rodam no endereço do portal).
const TIPO_SEGURO=/^(application\/pdf|image\/(jpeg|png|gif|webp|bmp)|text\/plain)$/i;
function abreNoNavegador(item){
  const m=String(item.tipo||'');
  if(!TIPO_SEGURO.test(m))return false;
  if(/pdf$/i.test(m))return navigator.pdfViewerEnabled!==false; // celular Android não mostra PDF: baixa
  return true;
}

// ---------- listagem ----------
async function carregar(pastaId){
  const n=++st.pedido;
  st.busca=null;
  desenharChips();
  $('docLinhas').innerHTML='<tr><td colspan="5" class="aa-semlinha">Carregando…</td></tr>';
  try{
    const d=await api('listar',{pastaId:pastaId||''});
    if(n!==st.pedido)return;
    st.pastaId=d.pasta.id||'';
    st.caminho=d.caminho||[{id:'',nome:'Raiz'}];
    st.pastas=d.pastas||[];
    st.arquivos=d.arquivos||[];
    st.limiteMb=d.limiteMb||st.limiteMb;
    st.usuario=d.usuario||st.usuario;
    try{history.replaceState(null,'',st.pastaId?'#p='+encodeURIComponent(st.pastaId):location.pathname+location.search);}catch(e){}
    pronto(true);
    desenhar();
  }catch(e){
    if(n!==st.pedido)return;
    if(e.status===404&&pastaId){aviso('Esta pasta não existe mais. Voltando para a raiz.');carregar('');return;}
    $('docLinhas').innerHTML=`<tr><td colspan="5" class="aa-semlinha">${esc(e.message||'Não foi possível carregar.')}</td></tr>`;
    mostrarErro(e);
    if(e.status===401)pronto(false);
  }
}

async function buscar(termo){
  termo=String(termo||'').trim();
  if(termo.length<2){aviso('Digite pelo menos 2 letras para buscar.');return;}
  const n=++st.pedido;
  st.busca={termo,arquivos:[],incompleta:false};
  desenharChips();
  $('docCrumb').innerHTML=`<span class="doc-crumb-busca">Busca: “${esc(termo)}”</span>`;
  $('docQtd').textContent='';
  $('docLinhas').innerHTML='<tr><td colspan="5" class="aa-semlinha">Buscando em todas as pastas…</td></tr>';
  try{
    const d=await api('buscar',{termo});
    if(n!==st.pedido)return;
    st.busca={termo,arquivos:d.arquivos||[],incompleta:Boolean(d.incompleta)};
    desenhar();
  }catch(e){
    if(n!==st.pedido)return;
    $('docLinhas').innerHTML=`<tr><td colspan="5" class="aa-semlinha">${esc(e.message||'Não foi possível buscar.')}</td></tr>`;
    mostrarErro(e);
  }
}

function desenharChips(){
  const el=$('docChips');
  if(st.busca){
    el.innerHTML=`<span class="aa-chip">Busca: ${esc(st.busca.termo)}<button type="button" id="chipLimpar" aria-label="Limpar busca">✕</button></span>`;
    $('chipLimpar').onclick=()=>{fecharBusca();carregar(st.pastaId);};
  }else{
    el.innerHTML='<span class="aa-sem">Sem busca ativa</span>';
  }
}

function desenharCaminho(){
  const c=st.caminho;
  $('docCrumb').innerHTML=c.map((p,i)=>i===c.length-1
    ?`<b>${esc(p.nome)}</b>`
    :`<button type="button" data-ir="${esc(p.id)}">${esc(p.nome)}</button><span class="doc-sep">›</span>`).join('');
  $('docCrumb').querySelectorAll('[data-ir]').forEach((b)=>b.onclick=()=>carregar(b.dataset.ir));
  document.querySelectorAll('[data-pasta-atual]').forEach((s)=>{s.textContent=c[c.length-1].nome;});
}

function linha(item,ehPasta){
  const t=ehPasta?{k:'pasta',r:''}:tipoDe(item.tipo,item.nome);
  const abre=!ehPasta&&abreNoNavegador(item);
  const acaoNome=ehPasta?'entrar':(abre?'abrir':'baixar');
  const sub=ehPasta?data(item.modificado):`${tamanho(item.tamanho)} · ${data(item.modificado)}`;
  const onde=st.busca?`<span class="aa-sub doc-onde">em <button type="button" class="aa-link" data-acao="irpasta" data-pasta="${esc(item.pastaId||'')}">${esc(item.pastaCaminho||'Raiz')}</button></span>`:'';
  const botoes=[
    abre?`<button type="button" class="doc-ab" data-acao="abrir" title="Abrir em nova aba" aria-label="Abrir ${esc(item.nome)}">${svg(IC.abrir,16)}<span>Abrir</span></button>`:'',
    !ehPasta?`<button type="button" class="doc-ab" data-acao="baixar" title="Baixar" aria-label="Baixar ${esc(item.nome)}">${svg(IC.baixar,16)}<span>Baixar</span></button>`:'',
    item.podeExcluir?`<button type="button" class="doc-ab doc-ab-perigo" data-acao="excluir" title="Excluir" aria-label="Excluir ${esc(item.nome)}">${svg(IC.lixo,16)}<span>Excluir</span></button>`:''
  ].join('');
  return `<tr data-id="${esc(item.id)}" data-pasta-linha="${ehPasta?1:0}">
    <td><div class="doc-nome">${icone(t)}<div class="doc-nome-tx"><button type="button" class="aa-link doc-nome-bt" data-acao="${acaoNome}" title="${esc(item.nome)}">${esc(item.nome)}</button><span class="aa-sub doc-sub-cel">${esc(sub)}</span>${onde}</div></div></td>
    <td class="aa-c doc-col-tam">${ehPasta?'—':esc(tamanho(item.tamanho))}</td>
    <td class="aa-c doc-col-data">${esc(data(item.modificado))}</td>
    <td class="doc-col-autor" title="${esc(item.enviadoPor||'')}">${esc(autor(item.enviadoPor))}</td>
    <td class="aa-c doc-col-acoes"><div class="doc-acoes">${botoes}</div></td>
  </tr>`;
}

function desenhar(){
  if(st.busca){
    const a=st.busca.arquivos;
    $('docCrumb').innerHTML=`<span class="doc-crumb-busca">Busca: “${esc(st.busca.termo)}”</span>`;
    $('docQtd').textContent=`${a.length} ${a.length===1?'arquivo':'arquivos'}${st.busca.incompleta?' (parcial)':''}`;
    $('docLinhas').innerHTML=a.map((x)=>linha(x,false)).join('')||'<tr><td colspan="5" class="aa-semlinha">Nenhum arquivo encontrado.</td></tr>';
    if(st.busca.incompleta)aviso('A busca parou nos primeiros resultados. Use um nome mais específico.','info');
    return;
  }
  desenharCaminho();
  const np=st.pastas.length,na=st.arquivos.length;
  $('docQtd').textContent=[np?`${np} ${np===1?'pasta':'pastas'}`:'',`${na} ${na===1?'arquivo':'arquivos'}`].filter(Boolean).join(' · ');
  $('docLinhas').innerHTML=st.pastas.map((p)=>linha(p,true)).join('')+st.arquivos.map((a)=>linha(a,false)).join('')
    ||'<tr><td colspan="5" class="aa-semlinha">Pasta vazia.</td></tr>';
}

function acharItem(id){
  const lista=st.busca?st.busca.arquivos:st.pastas.concat(st.arquivos);
  return lista.find((x)=>x.id===id);
}

// ---------- abrir / baixar ----------
function b64Blob(b64,tipo){
  const bin=atob(b64);
  const partes=[];
  for(let i=0;i<bin.length;i+=524288){
    const pedaco=bin.slice(i,i+524288);
    const u=new Uint8Array(pedaco.length);
    for(let j=0;j<pedaco.length;j++)u[j]=pedaco.charCodeAt(j);
    partes.push(u);
  }
  return new Blob(partes,{type:tipo||'application/octet-stream'});
}
function salvarBlob(blob,nome){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=nome||'arquivo';a.rel='noopener';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function ocupado(btn,on){if(!btn)return;btn.disabled=on;btn.classList.toggle('doc-ocupado',on);}

async function abrir(item,btn){
  // A aba nova é aberta já no clique (senão o navegador bloqueia como pop-up) e recebe o arquivo depois.
  const w=window.open('','_blank');
  if(w){try{w.document.title='Abrindo…';w.document.body.innerHTML='<p style="font:16px system-ui,sans-serif;padding:24px;color:#555">Abrindo '+esc(item.nome)+'…</p>';}catch(e){}}
  ocupado(btn,true);
  try{
    const d=await api('baixar',{arquivoId:item.id,modo:'abrir'});
    const seguro=TIPO_SEGURO.test(String(d.mimeType||''));
    const blob=b64Blob(d.base64,seguro?(/^text\//i.test(d.mimeType)?'text/plain;charset=utf-8':d.mimeType):'application/octet-stream');
    if(!seguro){if(w&&!w.closed)w.close();salvarBlob(blob,d.nome);return;}
    if(w&&!w.closed){
      const url=URL.createObjectURL(blob);
      w.location.href=url;
      setTimeout(()=>URL.revokeObjectURL(url),300000);
    }else{
      salvarBlob(blob,d.nome);
    }
  }catch(e){
    if(w&&!w.closed)w.close();
    mostrarErro(e);
  }finally{ocupado(btn,false);}
}
async function baixar(item,btn){
  ocupado(btn,true);
  try{
    const d=await api('baixar',{arquivoId:item.id,modo:'baixar'});
    salvarBlob(b64Blob(d.base64,d.mimeType),d.nome);
  }catch(e){mostrarErro(e);}
  finally{ocupado(btn,false);}
}

async function excluir(item,ehPasta,btn){
  const msg=ehPasta
    ?`Excluir a pasta "${item.nome}" e tudo o que está dentro dela?\n\nNada é apagado: a pasta vai para a área de excluídos e o Administrador pode recuperar.`
    :`Excluir "${item.nome}"?\n\nNada é apagado: o arquivo vai para a área de excluídos e o Administrador pode recuperar.`;
  if(!window.confirm(msg))return;
  ocupado(btn,true);
  try{
    await api('excluir',ehPasta?{pastaId:item.id}:{arquivoId:item.id});
    aviso(`"${item.nome}" foi excluído.`,'ok');
    if(st.busca)buscar(st.busca.termo);else carregar(st.pastaId);
  }catch(e){mostrarErro(e);ocupado(btn,false);}
}

$('docLinhas').addEventListener('click',(e)=>{
  const b=e.target.closest('[data-acao]');if(!b)return;
  const tr=b.closest('tr');
  const acao=b.dataset.acao;
  if(acao==='irpasta'){fecharBusca();carregar(b.dataset.pasta||'');return;}
  const item=acharItem(tr&&tr.dataset.id);if(!item)return;
  const ehPasta=tr.dataset.pastaLinha==='1';
  if(acao==='entrar')carregar(item.id);
  else if(acao==='abrir')abrir(item,b);
  else if(acao==='baixar')baixar(item,b);
  else if(acao==='excluir')excluir(item,ehPasta,b);
});

// ---------- envio ----------
function lerBase64(f,progresso){
  return new Promise((ok,nok)=>{
    const r=new FileReader();
    r.onprogress=(e)=>{if(e.lengthComputable)progresso(e.loaded/e.total);};
    r.onerror=()=>nok(falha(0,'Não foi possível ler o arquivo no aparelho.'));
    r.onload=()=>{const s=String(r.result||'');ok(s.slice(s.indexOf(',')+1));};
    r.readAsDataURL(f);
  });
}
function nomeFoto(f){
  // Foto da câmera do Android costuma vir como "image.jpg": dá um nome com data e hora.
  if(!/^(image|photo)?[\d_-]*\.(jpe?g|png|heic|webp)$/i.test(f.name||''))return f.name;
  const d=new Date(),p=(n)=>String(n).padStart(2,'0');
  const ext=(f.name.match(/\.[a-z0-9]+$/i)||['.jpg'])[0];
  return `Foto ${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}${ext}`;
}

function enfileirar(lista,daCamera){
  const arquivos=[...(lista||[])];
  if(!arquivos.length)return;
  if(!st.pronto){aviso('Aguarde a lista carregar para enviar.');return;}
  const destino={id:st.pastaId,nome:st.caminho[st.caminho.length-1].nome};
  if(!st.enviando&&st.fila.every((x)=>x.estado==='ok'||x.estado==='erro')){st.fila=[];$('envioLista').innerHTML='';}
  arquivos.forEach((f)=>{
    const nome=daCamera?nomeFoto(f):f.name;
    const it={f,nome,destino,estado:'espera',msg:'Na fila',lido:0};
    const li=document.createElement('li');
    li.innerHTML=`<span class="doc-envio-nome" title="${esc(nome)}">${esc(nome)}</span><span class="doc-envio-tam">${esc(tamanho(f.size))}</span><span class="doc-envio-est"></span>`;
    it.el=li;
    $('envioLista').appendChild(li);
    st.fila.push(it);
    if(f.size>st.limiteMb*MB)marcar(it,'erro',`Acima de ${st.limiteMb} MB. Não enviado.`);
    else if(!f.size)marcar(it,'erro','Arquivo vazio. Não enviado.');
    else marcar(it,'espera','Na fila');
  });
  $('docEnvios').hidden=false;
  $('btnFecharEnvios').hidden=true;
  atualizarBarra();
  if(!st.enviando)processarFila();
}
function marcar(it,estado,msg){
  it.estado=estado;it.msg=msg;
  it.el.className='doc-envio doc-e-'+estado;
  it.el.querySelector('.doc-envio-est').textContent=msg;
}
function atualizarBarra(){
  const validos=st.fila.filter((x)=>!(x.estado==='erro'&&!x.tentou));
  const total=validos.reduce((s,x)=>s+x.f.size,0)||1;
  const feito=validos.reduce((s,x)=>s+(x.estado==='ok'||x.estado==='erro'?x.f.size:x.estado==='enviando'?x.f.size*0.5:x.f.size*0.5*x.lido),0);
  $('envioBarra').style.width=Math.min(100,Math.round(feito/total*100))+'%';
  const ok=st.fila.filter((x)=>x.estado==='ok').length;
  const erro=st.fila.filter((x)=>x.estado==='erro').length;
  const resta=st.fila.length-ok-erro;
  $('envioResumo').textContent=resta?`${ok} de ${st.fila.length} enviados`:`${ok} enviado${ok===1?'':'s'}${erro?` · ${erro} com erro`:''}`;
  $('docEnvios').classList.toggle('doc-enviando',st.fila.some((x)=>x.estado==='enviando'));
}

async function processarFila(){
  st.enviando=true;
  let mudouAtual=false;
  try{
    for(const it of st.fila){
      if(it.estado!=='espera')continue;
      it.tentou=true;
      try{
        marcar(it,'lendo','Lendo… 0%');
        const b64=await lerBase64(it.f,(p)=>{it.lido=p;marcar(it,'lendo',`Lendo… ${Math.round(p*100)}%`);atualizarBarra();});
        it.lido=1;
        marcar(it,'enviando','Enviando…');atualizarBarra();
        const d=await api('subir',{pastaId:it.destino.id,nome:it.nome,mimeType:it.f.type||'application/octet-stream',base64:b64});
        marcar(it,'ok',d.renomeado?`Enviado como "${d.nome}"`:'Enviado');
        if(it.destino.id===st.pastaId)mudouAtual=true;
      }catch(e){
        marcar(it,'erro',e.message||'Falha no envio.');
        if(e.status===401){
          st.fila.filter((x)=>x.estado==='espera').forEach((x)=>marcar(x,'erro','Não enviado: sessão terminou.'));
          mostrarErro(e);
        }
      }
      atualizarBarra();
    }
  }finally{
    st.enviando=false;
    atualizarBarra();
    $('btnFecharEnvios').hidden=false;
    if(mudouAtual&&!st.busca)carregar(st.pastaId);
    if(st.fila.length&&st.fila.every((x)=>x.estado==='ok'))setTimeout(()=>{if(!st.enviando&&st.fila.every((x)=>x.estado==='ok'))$('docEnvios').hidden=true;},6000);
  }
}

// ---------- arrastar e soltar ----------
let arrasto=0;
const temArquivos=(e)=>Array.from((e.dataTransfer&&e.dataTransfer.types)||[]).includes('Files');
document.addEventListener('dragenter',(e)=>{if(!temArquivos(e))return;e.preventDefault();arrasto++;if(st.pronto){$('soltarDestino').textContent='na pasta '+st.caminho[st.caminho.length-1].nome;$('docSoltar').hidden=false;}});
document.addEventListener('dragover',(e)=>{if(!temArquivos(e))return;e.preventDefault();e.dataTransfer.dropEffect=st.pronto?'copy':'none';});
document.addEventListener('dragleave',(e)=>{if(!temArquivos(e))return;arrasto=Math.max(0,arrasto-1);if(!arrasto)$('docSoltar').hidden=true;});
document.addEventListener('drop',(e)=>{if(!temArquivos(e))return;e.preventDefault();arrasto=0;$('docSoltar').hidden=true;enfileirar(e.dataTransfer.files,false);});

// ---------- nova pasta ----------
function abrirModalPasta(){
  $('campoPasta').value='';$('erroPasta').hidden=true;
  $('formPasta').hidden=false;$('docVeu').classList.add('aa-on');
  setTimeout(()=>$('campoPasta').focus(),30);
}
function fecharModalPasta(){$('formPasta').hidden=true;$('docVeu').classList.remove('aa-on');}
$('formPasta').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const nome=$('campoPasta').value.trim();
  if(!nome)return;
  if(nome.startsWith('_')){$('erroPasta').textContent='O nome não pode começar com "_".';$('erroPasta').hidden=false;return;}
  const bt=$('formPasta').querySelector('[type=submit]');ocupado(bt,true);
  try{
    const d=await api('criarPasta',{pastaPaiId:st.pastaId,nome});
    fecharModalPasta();
    aviso(d.renomeado?`Pasta criada como "${d.nome}" (já existia uma com esse nome).`:`Pasta "${d.nome}" criada.`,'ok');
    carregar(st.pastaId);
  }catch(err){
    $('erroPasta').textContent=err.message||'Não foi possível criar a pasta.';$('erroPasta').hidden=false;
    if(err.status===401)mostrarErro(err);
  }finally{ocupado(bt,false);}
});
$('btnCancelarPasta').onclick=fecharModalPasta;
$('docVeu').onclick=fecharModalPasta;

// ---------- busca ----------
function abrirBusca(){$('formBusca').hidden=false;$('btnBuscar').classList.add('doc-on');setTimeout(()=>$('campoBusca').focus(),30);}
function fecharBusca(){$('formBusca').hidden=true;$('btnBuscar').classList.remove('doc-on');$('campoBusca').value='';}
$('formBusca').addEventListener('submit',(e)=>{e.preventDefault();buscar($('campoBusca').value);});
$('btnFecharBusca').onclick=()=>{const tinha=Boolean(st.busca);fecharBusca();if(tinha)carregar(st.pastaId);};

// ---------- barra de cima ----------
function pronto(on){
  st.pronto=on;
  ['btnSubir','btnCamera','btnNovaPasta','btnBuscar','btnAtualizar'].forEach((id)=>{$(id).disabled=!on;});
  document.querySelectorAll('[data-limite]').forEach((s)=>{s.textContent=st.limiteMb;});
}
function montarBotoes(){
  $('btnSubir').innerHTML=svg(IC.subir,19);
  $('btnCamera').innerHTML=svg(IC.camera,19);
  $('btnNovaPasta').innerHTML=svg(IC.novaPasta,19);
  $('btnBuscar').innerHTML=svg(IC.busca,19);
  $('btnAtualizar').innerHTML=svg(IC.atualizar,19);
  $('btnAjuda').innerHTML=svg(IC.ajuda,19);
  $('btnFecharEnvios').innerHTML=svg(IC.x,16);
  $('btnSubir').onclick=()=>$('inArquivos').click();
  $('btnCamera').onclick=()=>$('inCamera').click();
  $('inArquivos').onchange=(e)=>{enfileirar(e.target.files,false);e.target.value='';};
  $('inCamera').onchange=(e)=>{enfileirar(e.target.files,true);e.target.value='';};
  $('btnNovaPasta').onclick=abrirModalPasta;
  $('btnBuscar').onclick=()=>{$('formBusca').hidden?abrirBusca():$('campoBusca').focus();};
  $('btnAtualizar').onclick=()=>{if(st.busca)buscar(st.busca.termo);else carregar(st.pastaId);};
  $('btnFecharEnvios').onclick=()=>{$('docEnvios').hidden=true;};
  $('btnAjuda').onclick=(e)=>{e.stopPropagation();const p=$('popAjuda');p.hidden=!p.hidden;$('btnAjuda').setAttribute('aria-expanded',String(!p.hidden));};
  document.addEventListener('click',(e)=>{const p=$('popAjuda');if(!p.hidden&&!p.contains(e.target)){p.hidden=true;$('btnAjuda').setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',(e)=>{
    if(e.key!=='Escape')return;
    if(!$('formPasta').hidden)fecharModalPasta();
    else if(!$('popAjuda').hidden)$('popAjuda').hidden=true;
    else if(!$('formBusca').hidden){const tinha=Boolean(st.busca);fecharBusca();if(tinha)carregar(st.pastaId);}
  });
}

// ---------- início ----------
async function iniciar(){
  aplicarTema();
  montarBotoes();
  pronto(false);
  if(!URL_WEBAPP){
    $('docLinhas').innerHTML='<tr><td colspan="5" class="aa-semlinha">Módulo ainda não ligado ao Google Drive.</td></tr>';
    aviso('O módulo Documentos ainda não foi ligado ao Google Drive (falta publicar o Apps Script).','info');
    return;
  }
  if(!window.PortalSupabase||!window.PortalSupabase.isConfigured()){
    aviso('Login do portal não configurado.');return;
  }
  try{await token();}catch(e){
    $('docLinhas').innerHTML='<tr><td colspan="5" class="aa-semlinha">Entre no portal para ver os documentos.</td></tr>';
    mostrarErro(e);return;
  }
  const m=/^#p=([\w-]{10,100})$/.exec(location.hash||'');
  carregar(m?decodeURIComponent(m[1]):'');
}
iniciar();
})();
