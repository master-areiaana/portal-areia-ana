/**
 * Portal de Acessos — Grupo Areia Ana
 * Módulo DOCUMENTOS: Web App que lê e grava numa pasta fechada do Google Drive.
 *
 * Publicar como Web App:
 *   Executar como: eu (conta da empresa, dona da pasta)
 *   Quem pode acessar: qualquer pessoa
 * Por isso TODA chamada confere o login do portal (Supabase) antes de fazer qualquer coisa.
 *
 * O portal chama com:
 *   fetch(URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
 *                body: JSON.stringify({ acao, token, ...campos }) })
 * Sem cabeçalhos próprios e sem application/json (evita o preflight de CORS, que o Apps Script não responde).
 *
 * Resposta sempre em JSON: { ok:true, dados } ou { ok:false, status, erro }.
 * O Apps Script não deixa mudar o código HTTP; o "401" vai no campo status.
 *
 * Nada é apagado: "excluir" move para a subpasta _Excluidos.
 */

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------
// Valores iniciais usados por configurarInicial() SÓ quando a propriedade ainda está vazia.
// Nenhum é segredo: a URL e a chave anon do Supabase já são públicas no portal (assets/js/config.js).
// Depois de rodar configurarInicial(), quem manda são as Propriedades do Script.
var PADRAO = {
  PASTA_RAIZ_ID: '1XWhC21kdsYMUsvp3wu1a-j6STW8AR3bi',
  SUPABASE_URL: 'https://wwihohtoumcmocqcgcbo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3aWhvaHRvdW1jbW9jcWNnY2JvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODc0NjUsImV4cCI6MjA5OTA2MzQ2NX0.CcNARd6_K4h-6uW0U06FSRmxrOvJaoZvA8rCqHvCRro',
  TAMANHO_MAX_MB: '20',
  TAMANHO_MAX_BAIXAR_MB: '30',
  ADMINS: '',
  CACHE_LOGIN_SEG: '60',
  LOG_LISTAGEM: 'nao'
};

var NOME_EXCLUIDOS = '_Excluidos';
var NOME_SISTEMA = '_Sistema';
var NOME_PLANILHA = 'Portal - Documentos - Auditoria';
var CABECALHO_LOG = ['Data/hora', 'E-mail', 'Ação', 'Arquivo', 'Pasta', 'ID do arquivo', 'Tamanho', 'Resultado/erro'];
var NOMES_ACAO = { listar: 'listar', buscar: 'buscar', subir: 'subir', baixar: 'baixar', criarPasta: 'criar pasta', excluir: 'excluir' };

function cfg_() {
  var p = PropertiesService.getScriptProperties().getProperties();
  function v(k) { return (p[k] !== undefined && String(p[k]).trim() !== '') ? String(p[k]).trim() : PADRAO[k]; }
  return {
    raiz: v('PASTA_RAIZ_ID'),
    planilha: p.PLANILHA_AUDITORIA_ID || '',
    sbUrl: String(v('SUPABASE_URL') || '').replace(/\/+$/, ''),
    sbKey: v('SUPABASE_ANON_KEY'),
    maxMb: Number(v('TAMANHO_MAX_MB')) || 20,
    maxBaixarMb: Number(v('TAMANHO_MAX_BAIXAR_MB')) || 30,
    admins: String(v('ADMINS') || '').toLowerCase().split(/[\s,;]+/).filter(String),
    cacheSeg: Math.max(0, Math.min(300, Number(v('CACHE_LOGIN_SEG')) || 0)),
    logListagem: /^s/i.test(v('LOG_LISTAGEM') || '')
  };
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
function doPost(e) {
  var usuario = null;
  var reg = { acao: '', arquivo: '', pasta: '', id: '', tamanho: '' };
  try {
    var req;
    try { req = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (x) { throw erro_(400, 'Requisição inválida.'); }
    if (!req || typeof req !== 'object') throw erro_(400, 'Requisição inválida.');
    reg.acao = NOMES_ACAO[req.acao] || String(req.acao || '(sem ação)').slice(0, 40);
    if (req.acao === 'baixar' && req.modo === 'abrir') reg.acao = 'abrir';

    // 1) Login SEMPRE antes de qualquer coisa.
    usuario = conferirLogin_(req.token);

    // 2) Ação.
    var fn = ACOES[req.acao];
    if (!fn) throw erro_(400, 'Ação desconhecida.');
    var dados = fn(req, usuario, reg);

    if (deveRegistrar_(req.acao, true)) registrar_(usuario, reg, 'ok');
    return json_({ ok: true, dados: dados });
  } catch (err) {
    var status = err && err.status ? err.status : 500;
    var msg = err && err.status ? err.message : 'Erro interno. Tente de novo.';
    registrar_(usuario, reg, 'erro ' + status + ': ' + ((err && err.detalhe) || (err && err.message) || err));
    return json_({ ok: false, status: status, erro: msg });
  }
}

function doGet() {
  return json_({ ok: false, status: 405, erro: 'Use POST.' });
}

var ACOES = {
  listar: acaoListar_,
  buscar: acaoBuscar_,
  subir: acaoSubir_,
  baixar: acaoBaixar_,
  criarPasta: acaoCriarPasta_,
  excluir: acaoExcluir_
};

function deveRegistrar_(acao, sucesso) {
  if (!sucesso) return true;
  if (acao === 'listar' || acao === 'buscar') return cfg_().logListagem;
  return true;
}

// ---------------------------------------------------------------------------
// Login (Supabase): o script pergunta ao Supabase quem é o dono do token.
// Usa a mesma função do portal (portal_get_my_context), que devolve perfil, status e papel.
// O e-mail vem SEMPRE da resposta do Supabase, nunca do que a tela enviou.
// ---------------------------------------------------------------------------
function conferirLogin_(token) {
  if (!token || typeof token !== 'string' || token.length < 20 || token.length > 8000) {
    throw erro_(401, 'Sem login. Entre no portal novamente.', 'sem token');
  }
  var c = cfg_();
  var cache = CacheService.getScriptCache();
  var chave = 'login_' + hash_(token);
  if (c.cacheSeg > 0) {
    var guardado = cache.get(chave);
    if (guardado) return JSON.parse(guardado);
  }
  var r;
  try {
    r = UrlFetchApp.fetch(c.sbUrl + '/rest/v1/rpc/portal_get_my_context', {
      method: 'post',
      contentType: 'application/json',
      payload: '{}',
      headers: { apikey: c.sbKey, Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
  } catch (x) {
    throw erro_(503, 'Não foi possível conferir o login agora. Tente de novo.', 'falha ao chamar o Supabase: ' + x);
  }
  var cod = r.getResponseCode();
  if (cod === 401 || cod === 403) throw erro_(401, 'Login inválido ou expirado. Entre no portal novamente.', 'token recusado pelo Supabase (' + cod + ')');
  if (cod !== 200) throw erro_(503, 'Não foi possível conferir o login agora. Tente de novo.', 'Supabase respondeu ' + cod);
  var d;
  try { d = JSON.parse(r.getContentText()); } catch (x) { throw erro_(503, 'Não foi possível conferir o login agora.', 'resposta do Supabase inválida'); }
  if (!d || d.authenticated !== true) throw erro_(401, 'Login inválido ou expirado. Entre no portal novamente.', 'não autenticado');
  if (!d.profile) throw erro_(403, 'Seu usuário ainda não foi configurado no portal.', 'sem perfil no portal');
  var email = String(d.profile.email || '').trim().toLowerCase();
  if (d.profile.status !== 'ativo') throw erro_(403, 'Seu acesso está inativo ou bloqueado.', 'perfil ' + d.profile.status + ' (' + email + ')');
  if (!email) throw erro_(403, 'Seu usuário está sem e-mail no portal.', 'perfil sem e-mail');
  var u = {
    email: email,
    nome: String(d.profile.nome || email),
    admin: Boolean(d.role && d.role.is_admin) || c.admins.indexOf(email) >= 0
  };
  if (c.cacheSeg > 0) cache.put(chave, JSON.stringify(u), c.cacheSeg);
  return u;
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------
function acaoListar_(req, u, reg) {
  var pasta = pastaValida_(req.pastaId, reg);
  var c = cfg_();
  var ehRaiz = pasta.getId() === c.raiz;
  var reservadas = ehRaiz ? idsReservados_() : {};
  var pastas = [], arquivos = [];

  var itP = pasta.getFolders();
  while (itP.hasNext()) {
    var f = itP.next();
    if (reservadas[f.getId()] || (ehRaiz && nomeReservado_(f.getName()))) continue;
    pastas.push({
      id: f.getId(), nome: f.getName(), tipo: 'pasta',
      modificado: iso_(f.getLastUpdated()),
      enviadoPor: autor_(f.getDescription()),
      podeExcluir: u.admin
    });
  }
  var itA = pasta.getFiles();
  while (itA.hasNext()) {
    var a = itA.next();
    var item = descreverArquivo_(a, u);
    if (item) arquivos.push(item);
  }
  pastas.sort(porNome_);
  arquivos.sort(porNome_);
  reg.pasta = caminhoTexto_(pasta);
  return {
    pasta: { id: ehRaiz ? '' : pasta.getId(), nome: ehRaiz ? 'Raiz' : pasta.getName() },
    caminho: caminhoLista_(pasta),
    pastas: pastas,
    arquivos: arquivos,
    limiteMb: c.maxMb,
    usuario: { email: u.email, nome: u.nome, admin: u.admin }
  };
}

function acaoBuscar_(req, u, reg) {
  var termo = normalizar_(req.termo);
  reg.arquivo = 'busca: ' + String(req.termo || '').slice(0, 80);
  if (termo.length < 2) throw erro_(400, 'Digite pelo menos 2 letras para buscar.');
  var c = cfg_();
  var raiz = DriveApp.getFolderById(c.raiz);
  var reservadas = idsReservados_();
  var achados = [];
  var inicio = Date.now();
  var visitados = 0;
  var LIMITE = 200, LIMITE_ITENS = 5000, LIMITE_MS = 20000;
  var incompleta = false;

  // Percorre a árvore a partir da raiz (nunca sai dela). Fila: [pasta, caminho em texto, id da pasta ou ''].
  var fila = [[raiz, '', '']];
  while (fila.length) {
    if (achados.length >= LIMITE || visitados >= LIMITE_ITENS || Date.now() - inicio > LIMITE_MS) { incompleta = true; break; }
    var atual = fila.shift();
    var pasta = atual[0], caminho = atual[1], pastaId = atual[2];
    var ehRaiz = pastaId === '';
    var itA = pasta.getFiles();
    while (itA.hasNext()) {
      visitados++;
      var a = itA.next();
      if (normalizar_(a.getName()).indexOf(termo) >= 0) {
        var item = descreverArquivo_(a, u);
        if (item) {
          item.pastaId = pastaId;
          item.pastaCaminho = caminho || 'Raiz';
          achados.push(item);
          if (achados.length >= LIMITE) break;
        }
      }
    }
    var itP = pasta.getFolders();
    while (itP.hasNext()) {
      visitados++;
      var f = itP.next();
      if (ehRaiz && (reservadas[f.getId()] || nomeReservado_(f.getName()))) continue;
      fila.push([f, caminho ? caminho + ' › ' + f.getName() : f.getName(), f.getId()]);
    }
  }
  achados.sort(porNome_);
  return { termo: String(req.termo || ''), arquivos: achados, incompleta: incompleta, limiteMb: c.maxMb };
}

function acaoSubir_(req, u, reg) {
  var c = cfg_();
  var nome = limparNome_(req.nome);
  reg.arquivo = nome;
  var pasta = pastaValida_(req.pastaId, reg);
  reg.pasta = caminhoTexto_(pasta);
  var b64 = String(req.base64 || '');
  if (!b64) throw erro_(400, 'Arquivo vazio.');
  var limite = c.maxMb * 1024 * 1024;
  // Confere o tamanho antes de decodificar (base64 tem ~4/3 do tamanho real).
  if (Math.floor(b64.length * 3 / 4) > limite + 4) {
    reg.tamanho = tamanhoTexto_(Math.floor(b64.length * 3 / 4));
    throw erro_(413, 'Arquivo acima de ' + c.maxMb + ' MB. Não foi enviado.');
  }
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (x) { throw erro_(400, 'Arquivo corrompido no envio. Tente de novo.'); }
  reg.tamanho = tamanhoTexto_(bytes.length);
  if (bytes.length === 0) throw erro_(400, 'Arquivo vazio.');
  if (bytes.length > limite) throw erro_(413, 'Arquivo acima de ' + c.maxMb + ' MB. Não foi enviado.');

  var mime = /^[\w.+-]+\/[\w.+-]+$/.test(String(req.mimeType || '')) ? String(req.mimeType) : 'application/octet-stream';
  var trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    var nomeFinal = nomeLivre_(nome, function (n) { return pasta.getFilesByName(n).hasNext(); }, true);
    var arq = pasta.createFile(Utilities.newBlob(bytes, mime, nomeFinal));
    arq.setDescription('Enviado por: ' + u.email);
    reg.arquivo = nomeFinal;
    reg.id = arq.getId();
    return { id: arq.getId(), nome: nomeFinal, renomeado: nomeFinal !== nome };
  } finally {
    trava.releaseLock();
  }
}

function acaoBaixar_(req, u, reg) {
  var c = cfg_();
  var a = arquivoValido_(req.arquivoId, reg);
  reg.arquivo = a.getName();
  reg.id = a.getId();
  reg.pasta = caminhoTexto_(pastaDe_(a));
  var mime = a.getMimeType();
  var nome = a.getName();
  var blob;
  if (mime.indexOf('application/vnd.google-apps.') === 0) {
    // Documento nativo do Google: exporta para o formato do Office (ou PDF).
    var exp = EXPORTAR[mime];
    if (!exp) throw erro_(415, 'Este tipo de arquivo do Google não pode ser baixado pelo portal.');
    var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(a.getId()) +
      '/export?mimeType=' + encodeURIComponent(exp[0]), {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) throw erro_(502, 'Não foi possível converter o arquivo para baixar.', 'export ' + r.getResponseCode());
    blob = r.getBlob();
    mime = exp[0];
    if (!new RegExp('\\.' + exp[1] + '$', 'i').test(nome)) nome += '.' + exp[1];
  } else {
    if (a.getSize() > c.maxBaixarMb * 1024 * 1024) {
      reg.tamanho = tamanhoTexto_(a.getSize());
      throw erro_(413, 'Arquivo acima de ' + c.maxBaixarMb + ' MB. Nesta fase ele não pode ser baixado pelo portal.');
    }
    blob = a.getBlob();
  }
  var bytes = blob.getBytes();
  reg.tamanho = tamanhoTexto_(bytes.length);
  return { nome: nome, mimeType: mime, base64: Utilities.base64Encode(bytes) };
}

var EXPORTAR = {
  'application/vnd.google-apps.document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  'application/vnd.google-apps.spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
  'application/vnd.google-apps.presentation': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
  'application/vnd.google-apps.drawing': ['application/pdf', 'pdf']
};

function acaoCriarPasta_(req, u, reg) {
  var nome = limparNome_(req.nome);
  reg.arquivo = nome;
  if (nome.charAt(0) === '_') throw erro_(400, 'O nome da pasta não pode começar com "_".');
  var pai = pastaValida_(req.pastaPaiId, reg);
  reg.pasta = caminhoTexto_(pai);
  var trava = LockService.getScriptLock();
  trava.waitLock(30000);
  try {
    var nomeFinal = nomeLivre_(nome, function (n) { return pai.getFoldersByName(n).hasNext(); }, false);
    var nova = pai.createFolder(nomeFinal);
    nova.setDescription('Criada por: ' + u.email);
    reg.arquivo = nomeFinal;
    reg.id = nova.getId();
    return { id: nova.getId(), nome: nomeFinal, renomeado: nomeFinal !== nome };
  } finally {
    trava.releaseLock();
  }
}

function acaoExcluir_(req, u, reg) {
  var lixo = pastaExcluidos_();
  var quando = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
  if (req.pastaId) {
    // Pasta: só Administrador, e nunca a raiz.
    if (!u.admin) throw erro_(403, 'Só o Administrador pode excluir pastas.');
    var p = pastaValida_(req.pastaId, reg);
    if (p.getId() === cfg_().raiz) throw erro_(400, 'A pasta raiz não pode ser excluída.');
    reg.arquivo = '[pasta] ' + p.getName();
    reg.id = p.getId();
    reg.pasta = caminhoTexto_(pastaDe_(p));
    p.setDescription(textoExclusao_(p.getDescription(), u.email, quando, reg.pasta, pastaDe_(p).getId()));
    p.moveTo(lixo);
    return { ok: true };
  }
  var a = arquivoValido_(req.arquivoId, reg);
  reg.arquivo = a.getName();
  reg.id = a.getId();
  reg.tamanho = tamanhoTexto_(a.getSize());
  var origem = pastaDe_(a);
  reg.pasta = caminhoTexto_(origem);
  var autor = autor_(a.getDescription());
  if (!u.admin && autor !== u.email) throw erro_(403, 'Você só pode excluir arquivos que você mesmo enviou.');
  a.setDescription(textoExclusao_(a.getDescription(), u.email, quando, reg.pasta, origem.getId()));
  a.moveTo(lixo);
  return { ok: true };
}

function textoExclusao_(descricao, email, quando, caminho, origemId) {
  return (descricao ? descricao + '\n' : '') +
    'Excluído por: ' + email + ' em ' + quando + '\n' +
    'Pasta de origem: ' + caminho + ' (' + origemId + ')';
}

// ---------------------------------------------------------------------------
// Segurança: tudo tem de estar DENTRO da pasta raiz, fora de _Excluidos e _Sistema.
// ---------------------------------------------------------------------------
/** Sobe pelos pais até a raiz. Devolve as pastas entre a raiz e o item (sem a raiz e sem o item), ou null se estiver fora. */
function cadeia_(item) {
  var raiz = cfg_().raiz;
  var lista = [];
  var atual = item;
  for (var i = 0; i < 60; i++) {
    var pais = atual.getParents();
    if (!pais.hasNext()) return null;
    var pai = pais.next();
    if (pai.getId() === raiz) return lista.reverse();
    lista.push(pai);
    atual = pai;
  }
  return null;
}

function emAreaReservada_(cadeia, item) {
  // A pasta de 1º nível define se está em _Excluidos ou _Sistema.
  var primeira = cadeia.length ? cadeia[0] : item;
  var res = idsReservados_();
  return Boolean(res[primeira.getId()]) || nomeReservado_(primeira.getName());
}

function pastaValida_(id, reg) {
  var c = cfg_();
  if (!id) return DriveApp.getFolderById(c.raiz);
  id = String(id);
  if (!/^[\w-]{10,100}$/.test(id)) throw erro_(400, 'Pasta inválida.');
  if (id === c.raiz) return DriveApp.getFolderById(c.raiz);
  var p;
  try { p = DriveApp.getFolderById(id); p.getName(); } catch (x) { throw erro_(404, 'Pasta não encontrada.', 'pasta inexistente ou sem acesso: ' + id); }
  if (p.isTrashed()) throw erro_(404, 'Pasta não encontrada.', 'pasta na lixeira: ' + id);
  var cad = cadeia_(p);
  if (cad === null) { if (reg) reg.id = id; throw erro_(404, 'Pasta não encontrada.', 'recusado: pasta fora da pasta raiz (' + id + ')'); }
  if (emAreaReservada_(cad, p)) { if (reg) reg.id = id; throw erro_(404, 'Pasta não encontrada.', 'recusado: pasta reservada (' + id + ')'); }
  return p;
}

function arquivoValido_(id, reg) {
  id = String(id || '');
  if (!/^[\w-]{10,100}$/.test(id)) throw erro_(400, 'Arquivo inválido.');
  if (reg) reg.id = id;
  var a;
  try { a = DriveApp.getFileById(id); a.getName(); } catch (x) { throw erro_(404, 'Arquivo não encontrado.', 'arquivo inexistente ou sem acesso: ' + id); }
  if (a.isTrashed()) throw erro_(404, 'Arquivo não encontrado.', 'arquivo na lixeira: ' + id);
  var cad = cadeia_(a);
  if (cad === null) throw erro_(404, 'Arquivo não encontrado.', 'recusado: arquivo fora da pasta raiz (' + id + ')');
  if (cad.length && emAreaReservada_(cad, a)) throw erro_(404, 'Arquivo não encontrado.', 'recusado: arquivo em pasta reservada (' + id + ')');
  if (a.getMimeType() === 'application/vnd.google-apps.shortcut') throw erro_(415, 'Atalhos não podem ser abertos pelo portal.');
  return a;
}

function nomeReservado_(nome) {
  return nome === NOME_EXCLUIDOS || nome === NOME_SISTEMA;
}

function idsReservados_() {
  var res = {};
  var id = PropertiesService.getScriptProperties().getProperty('PASTA_EXCLUIDOS_ID');
  if (id) res[id] = true;
  return res;
}

function pastaExcluidos_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PASTA_EXCLUIDOS_ID');
  if (id) {
    try {
      var p = DriveApp.getFolderById(id);
      if (!p.isTrashed() && cadeia_(p) !== null) return p;
    } catch (x) { /* recria abaixo */ }
  }
  var raiz = DriveApp.getFolderById(cfg_().raiz);
  var it = raiz.getFoldersByName(NOME_EXCLUIDOS);
  var pasta = it.hasNext() ? it.next() : raiz.createFolder(NOME_EXCLUIDOS);
  props.setProperty('PASTA_EXCLUIDOS_ID', pasta.getId());
  return pasta;
}

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------
function descreverArquivo_(a, u) {
  var mime = a.getMimeType();
  if (mime === 'application/vnd.google-apps.shortcut' || mime === 'application/vnd.google-apps.form') return null;
  var autor = autor_(a.getDescription());
  return {
    id: a.getId(),
    nome: a.getName(),
    tipo: mime,
    tamanho: a.getSize(),
    modificado: iso_(a.getLastUpdated()),
    enviadoPor: autor,
    podeExcluir: u.admin || (autor !== '' && autor === u.email)
  };
}

function autor_(descricao) {
  var m = /(?:Enviado|Criada) por:\s*([^\s]+@[^\s]+)/i.exec(String(descricao || ''));
  return m ? m[1].toLowerCase() : '';
}

function pastaDe_(item) {
  var pais = item.getParents();
  return pais.hasNext() ? pais.next() : DriveApp.getFolderById(cfg_().raiz);
}

function caminhoLista_(pasta) {
  var lista = [{ id: '', nome: 'Raiz' }];
  if (pasta.getId() === cfg_().raiz) return lista;
  var cad = cadeia_(pasta) || [];
  cad.forEach(function (p) { lista.push({ id: p.getId(), nome: p.getName() }); });
  lista.push({ id: pasta.getId(), nome: pasta.getName() });
  return lista;
}

function caminhoTexto_(pasta) {
  try { return caminhoLista_(pasta).map(function (p) { return p.nome; }).join(' › '); } catch (x) { return ''; }
}

function limparNome_(nome) {
  var n = String(nome || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '-').replace(/\s+/g, ' ').trim();
  if (!n || n === '.' || n === '..') throw erro_(400, 'Informe um nome válido.');
  if (n.length > 200) {
    var m = /(\.[^.]{1,10})$/.exec(n);
    n = n.slice(0, 200 - (m ? m[1].length : 0)) + (m ? m[1] : '');
  }
  return n;
}

/** "relatorio.pdf" ocupado → "relatorio (2).pdf", "relatorio (3).pdf"… */
function nomeLivre_(nome, existe, comExtensao) {
  if (!existe(nome)) return nome;
  var base = nome, ext = '';
  if (comExtensao) {
    var m = /^(.+?)(\.[^.\s]{1,10})$/.exec(nome);
    if (m) { base = m[1]; ext = m[2]; }
  }
  for (var i = 2; i < 1000; i++) {
    var n = base + ' (' + i + ')' + ext;
    if (!existe(n)) return n;
  }
  throw erro_(409, 'Já existem arquivos demais com este nome nesta pasta.');
}

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function porNome_(a, b) {
  return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function iso_(d) { return d ? d.toISOString() : ''; }

function tamanhoTexto_(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.', ',') + ' KB';
  return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function erro_(status, mensagem, detalhe) {
  var e = new Error(mensagem);
  e.status = status;
  e.detalhe = detalhe || '';
  return e;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Auditoria (planilha "Portal - Documentos - Auditoria", aba Log)
// O token e o conteúdo do arquivo NUNCA são gravados.
// ---------------------------------------------------------------------------
function registrar_(usuario, reg, resultado) {
  try {
    var id = cfg_().planilha;
    if (!id) { console.error('PLANILHA_AUDITORIA_ID vazio: rode configurarInicial().'); return; }
    var aba = SpreadsheetApp.openById(id).getSheetByName('Log');
    aba.appendRow([
      new Date(),
      usuario ? usuario.email : '(sem login válido)',
      reg.acao || '',
      String(reg.arquivo || '').slice(0, 300),
      String(reg.pasta || '').slice(0, 300),
      reg.id || '',
      reg.tamanho || '',
      String(resultado || '').slice(0, 500)
    ]);
  } catch (x) {
    console.error('Falha ao gravar a auditoria: ' + x);
  }
}

// ---------------------------------------------------------------------------
// Rodar UMA VEZ no editor (menu Executar), na conta da empresa.
// Preenche as Propriedades do Script que estiverem vazias, cria _Excluidos,
// cria a planilha de auditoria e confere se a pasta raiz está fechada.
// ---------------------------------------------------------------------------
function configurarInicial() {
  var props = PropertiesService.getScriptProperties();
  var atuais = props.getProperties();
  Object.keys(PADRAO).forEach(function (k) {
    if (atuais[k] === undefined || String(atuais[k]).trim() === '') props.setProperty(k, PADRAO[k]);
  });
  var c = cfg_();
  var raiz = DriveApp.getFolderById(c.raiz);
  var dono = raiz.getOwner() ? raiz.getOwner().getEmail() : '(sem dono: Drive compartilhado)';
  var eu = Session.getEffectiveUser().getEmail();
  console.log('Pasta raiz: ' + raiz.getName() + ' | dona: ' + dono + ' | script rodando como: ' + eu);
  if (dono !== eu) console.warn('ATENÇÃO: a pasta raiz não pertence à conta que está rodando o script.');

  var acesso = raiz.getSharingAccess();
  if (acesso !== DriveApp.Access.PRIVATE) {
    console.warn('ATENÇÃO: a pasta raiz está compartilhada por link (' + acesso + '). Feche o compartilhamento por link no Drive.');
  } else {
    console.log('OK: pasta raiz sem compartilhamento por link.');
  }

  var lixo = pastaExcluidos_();
  console.log('OK: pasta _Excluidos: ' + lixo.getId());

  var planilha = null;
  if (c.planilha) { try { planilha = SpreadsheetApp.openById(c.planilha); } catch (x) { planilha = null; } }
  if (!planilha) {
    planilha = SpreadsheetApp.create(NOME_PLANILHA); // fica no Meu Drive da conta, FORA da pasta raiz
    props.setProperty('PLANILHA_AUDITORIA_ID', planilha.getId());
  }
  var log = planilha.getSheetByName('Log');
  if (!log) {
    log = planilha.getSheets()[0];
    log.setName('Log');
  }
  if (log.getLastRow() === 0) {
    log.appendRow(CABECALHO_LOG);
    log.getRange(1, 1, 1, CABECALHO_LOG.length).setFontWeight('bold').setBackground('#17140F').setFontColor('#FFFFFF');
    log.setFrozenRows(1);
    log.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
  var par = planilha.getSheetByName('Parâmetros') || planilha.insertSheet('Parâmetros');
  par.clear();
  par.getRange(1, 1, 7, 2).setValues([
    ['Parâmetro (só leitura: quem manda são as Propriedades do Script)', 'Valor'],
    ['Pasta raiz', raiz.getName() + ' (' + c.raiz + ')'],
    ['Pasta _Excluidos', lixo.getId()],
    ['Tamanho máximo para subir (MB)', c.maxMb],
    ['Tamanho máximo para baixar (MB)', c.maxBaixarMb],
    ['Administradores extras (ADMINS)', c.admins.join(', ') || '(só o perfil Administrador do portal)'],
    ['Atualizado em', new Date()]
  ]);
  par.getRange(1, 1, 1, 2).setFontWeight('bold');
  par.autoResizeColumns(1, 2);
  console.log('OK: planilha de auditoria: ' + planilha.getUrl());
  console.log('Pronto. Agora publique: Implantar > Nova implantação > App da Web.');
}

/**
 * Confere a conexão com o Supabase sem login de usuário.
 * O esperado é uma RECUSA (401, 403 ou 404 com "permission denied"): prova que o endereço e a chave
 * estão certos e que a função não abre para quem não está logado.
 */
function testarSupabase() {
  var c = cfg_();
  var r = UrlFetchApp.fetch(c.sbUrl + '/rest/v1/rpc/portal_get_my_context', {
    method: 'post', contentType: 'application/json', payload: '{}',
    headers: { apikey: c.sbKey, Authorization: 'Bearer ' + c.sbKey }, muteHttpExceptions: true
  });
  console.log('Supabase respondeu ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
}
