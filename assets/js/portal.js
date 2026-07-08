(function(){
  const state={context:null,active:null};
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function aplicarTema(theme){const b=document.body,btn=$('themeToggle');if(theme==='light'){b.classList.add('light-mode');if(btn)btn.textContent='Modo escuro';}else{b.classList.remove('light-mode');if(btn)btn.textContent='Modo claro';}localStorage.setItem('portalTheme',theme);}
  function toggleTheme(){aplicarTema(document.body.classList.contains('light-mode')?'dark':'light');}
  function showLogin(msg){$('loginOverlay').style.display='flex';$('portal').style.display='none';$('logoutBtn').style.display='none';const e=$('erroLogin');if(msg){e.textContent=msg;e.style.display='block';}}
  function showPortal(){$('loginOverlay').style.display='none';$('portal').style.display='block';$('logoutBtn').style.display='inline-block';}
  async function log(action,entityType=null,entityId=null,details=null){try{const c=window.PortalSupabase.getClient();if(c)await c.rpc('portal_log_event',{p_action:action,p_entity_type:entityType,p_entity_id:entityId,p_details:details});}catch(e){console.warn('Log não registrado:',e.message);}}

  async function loadContext(){
    const c=window.PortalSupabase.getClient();
    const {data,error}=await c.rpc('portal_get_my_context');
    if(error)throw error;
    if(!data||data.authenticated===false){showLogin();return;}
    if(!data.profile){showLogin('Seu usuário ainda não foi configurado no portal. Solicite liberação ao administrador.');return;}
    if(data.profile.status!=='ativo'){showLogin('Seu acesso está inativo ou bloqueado. Solicite liberação ao administrador.');return;}
    state.context=data;
    $('userName').textContent=data.profile.nome||data.profile.email;
    $('userRole').textContent=data.role?.nome||'Sem perfil';
    renderMenu(data.modules||[]);
    renderSections(data.modules||[],data.resources||[]);
    showPortal();
    if((data.modules||[])[0]) showSection(data.modules[0].codigo);
    await log('login_ok');
  }

  function groupResources(resources){return (resources||[]).reduce((acc,r)=>{acc[r.module_id]=acc[r.module_id]||[];acc[r.module_id].push(r);return acc;},{});}
  function renderMenu(modules){$('mainMenu').innerHTML=modules.map((m,i)=>`<button class="menu-btn ${i===0?'active':''}" type="button" data-module="${esc(m.codigo)}">${esc(m.nome)}</button>`).join('');document.querySelectorAll('[data-module]').forEach(b=>b.onclick=()=>showSection(b.dataset.module));}
  function renderSections(modules,resources){
    const grouped=groupResources(resources);
    $('sectionsRoot').innerHTML=modules.map((m,i)=>{
      const cards=m.codigo==='admin'?'<div id="adminRoot"></div>':`<div class="grid">${(grouped[m.id]||[]).map(card).join('')||'<div class="empty-card">Nenhum recurso liberado.</div>'}</div>`;
      return `<section id="section-${esc(m.codigo)}" class="section ${i===0?'':'hidden'}"><div class="section-title">${esc(m.nome)}</div>${cards}</section>`;
    }).join('');
    document.querySelectorAll('[data-resource-code]').forEach(a=>a.onclick=()=>log('open_resource','portal_resources',null,{resource_code:a.dataset.resourceCode,title:a.dataset.resourceTitle}));
  }
  function card(r){return `<a class="link-card" target="${esc(r.target||'_blank')}" href="${esc(r.url)}" data-resource-code="${esc(r.codigo)}" data-resource-title="${esc(r.titulo)}"><div class="link-title">${esc(r.titulo)}</div><div class="link-meta">${esc(r.subtitulo||'')}</div></a>`;}
  function showSection(code){state.active=code;document.querySelectorAll('.section').forEach(s=>s.classList.add('hidden'));const target=$(`section-${code}`);if(target)target.classList.remove('hidden');document.querySelectorAll('.menu-btn').forEach(b=>b.classList.toggle('active',b.dataset.module===code));if(code==='admin'&&window.PortalAdmin)window.PortalAdmin.mount(state.context);}

  async function handleLogin(ev){ev.preventDefault();$('erroLogin').style.display='none';try{await window.PortalAuth.signIn($('email').value.trim().toLowerCase(),$('senha').value);await loadContext();}catch(e){$('erroLogin').textContent=e.message&&e.message.includes('Invalid login credentials')?'E-mail ou senha incorretos.':(e.message||'Não foi possível entrar.');$('erroLogin').style.display='block';}}
  async function logout(){await log('logout');await window.PortalAuth.signOut();state.context=null;showLogin();}
  async function init(){aplicarTema(localStorage.getItem('portalTheme')||'dark');$('themeToggle').onclick=toggleTheme;$('loginForm').onsubmit=handleLogin;$('logoutBtn').onclick=logout;if(!window.PortalSupabase.isConfigured()){showLogin('Supabase ainda não foi configurado. Preencha assets/js/config.js.');return;}try{const session=await window.PortalAuth.getSession();if(session)await loadContext();else showLogin();}catch(e){showLogin(e.message||'Erro ao carregar sessão.');}}

  window.PortalApp={reload:loadContext,log};
  document.addEventListener('DOMContentLoaded',init);
})();
