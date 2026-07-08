(function(){
  async function getSession(){const c=window.PortalSupabase.getClient();if(!c)return null;const {data,error}=await c.auth.getSession();if(error)throw error;return data.session;}
  async function signIn(email,password){const c=window.PortalSupabase.getClient();if(!c)throw new Error('Supabase não configurado.');const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;return data;}
  async function signOut(){const c=window.PortalSupabase.getClient();if(c)await c.auth.signOut();}
  async function requestPasswordReset(email){const c=window.PortalSupabase.getClient();if(!c)throw new Error('Supabase não configurado.');const redirectTo=window.location.origin+window.location.pathname;const {error}=await c.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;}
  async function updatePassword(novaSenha){const c=window.PortalSupabase.getClient();if(!c)throw new Error('Supabase não configurado.');const {error}=await c.auth.updateUser({password:novaSenha});if(error)throw error;}
  window.PortalAuth={getSession,signIn,signOut,requestPasswordReset,updatePassword};
})();
