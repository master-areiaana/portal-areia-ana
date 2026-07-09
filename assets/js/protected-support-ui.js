(function(){
  const protectedEmail='portalcore.consult@gmail.com';
  const protectedUsername='portalcore.consult';
  const protectedName='Mariana Queiroz';

  function norm(value){
    return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function isProtectedText(text){
    const t=norm(text);
    return t.includes(protectedEmail)||t.includes(protectedUsername)||t.includes(norm(protectedName));
  }

  function hideProtectedSupportFromAdminUi(){
    const admin=document.getElementById('adminContent');
    if(!admin)return;

    admin.querySelectorAll('table.admin-table tbody tr').forEach(function(row){
      if(isProtectedText(row.textContent)){
        row.remove();
      }
    });

    admin.querySelectorAll('select option').forEach(function(option){
      if(isProtectedText(option.textContent)||isProtectedText(option.value)){
        option.remove();
      }
    });
  }

  function start(){
    hideProtectedSupportFromAdminUi();
    const root=document.getElementById('adminRoot')||document.body;
    const observer=new MutationObserver(hideProtectedSupportFromAdminUi);
    observer.observe(root,{childList:true,subtree:true});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start);
  }else{
    start();
  }
})();
