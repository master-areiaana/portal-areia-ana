(function(){
  function config(){return window.PORTAL_SUPABASE_CONFIG||{};}
  function isConfigured(){const c=config();return Boolean(c.url&&c.anonKey&&c.url.includes('supabase.co')&&c.anonKey.length>20);}
  let client=null;
  function getClient(){
    if(!isConfigured()) return null;
    if(!window.supabase||typeof window.supabase.createClient!=='function') return null;
    if(!client){const c=config();client=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
    return client;
  }
  window.PortalSupabase={config,isConfigured,getClient};
})();
