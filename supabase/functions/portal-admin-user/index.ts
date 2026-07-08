// Edge Function: portal-admin-user
// Cria/localiza usuarios no Supabase Auth e atualiza o portal_profiles.
// Somente usuarios com perfil "suporte" (is_admin=true, status=ativo) podem chamar esta funcao.
// A service_role_key e usada apenas aqui dentro, nunca no front-end.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://master-areiaana.github.io/portal-areia-ana/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "Configuracao do servidor incompleta." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "Acesso negado." }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: authData, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !authData || !authData.user) {
    return jsonResponse({ error: "Acesso negado." }, 401);
  }
  const callerId = authData.user.id;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const profileRes = await adminClient
    .from("portal_profiles")
    .select("status, role_id")
    .eq("id", callerId)
    .maybeSingle();

  if (profileRes.error || !profileRes.data || profileRes.data.status !== "ativo") {
    return jsonResponse({ error: "Acesso negado." }, 403);
  }

  const roleRes = await adminClient
    .from("portal_roles")
    .select("codigo, is_admin")
    .eq("id", profileRes.data.role_id)
    .maybeSingle();

  if (roleRes.error || !roleRes.data || roleRes.data.codigo !== "suporte" || roleRes.data.is_admin !== true) {
    return jsonResponse({ error: "Acesso negado." }, 403);
  }

  let body = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }

  const action = body.action;
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return jsonResponse({ error: "E-mail e obrigatorio." }, 400);

  if (action === "invite") {
    const nome = body.nome ? String(body.nome).trim() : "";
    const roleCodigo = body.role_codigo ? String(body.role_codigo).trim() : "";
    const status = body.status ? String(body.status).trim() : "ativo";
    const cargo = body.cargo || null;
    const area = body.area || null;
    const unidade = body.unidade || null;
    const gestor = body.gestor || null;
    const validade = body.validade_acesso || null;
    const observacoes = body.observacoes || null;

    if (!nome || !roleCodigo) {
      return jsonResponse({ error: "Nome e perfil sao obrigatorios." }, 400);
    }

    let targetUserId = null;
    const inviteRes = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL });

    if (inviteRes.error) {
      const msg = inviteRes.error.message || "";
      const alreadyExists = /already registered|already exists|already been registered/i.test(msg);
      if (!alreadyExists) {
        return jsonResponse({ error: "Nao foi possivel enviar o convite." }, 400);
      }
      const listRes = await adminClient.auth.admin.listUsers();
      if (listRes.error) return jsonResponse({ error: "Nao foi possivel localizar o usuario." }, 400);
      const users = (listRes.data && listRes.data.users) || [];
      const existing = users.find((u) => (u.email || "").toLowerCase() === email);
      if (!existing) return jsonResponse({ error: "Nao foi possivel localizar o usuario." }, 400);
      targetUserId = existing.id;
      await adminClient.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
    } else {
      targetUserId = (inviteRes.data && inviteRes.data.user && inviteRes.data.user.id) || null;
    }

    const upsertRes = await callerClient.rpc("portal_admin_upsert_profile_by_email", {
      p_email: email,
      p_nome: nome,
      p_role_codigo: roleCodigo,
      p_status: status,
      p_cargo: cargo,
      p_area: area,
      p_unidade: unidade,
      p_gestor: gestor,
      p_validade_acesso: validade,
      p_observacoes: observacoes,
    });

    if (upsertRes.error) {
      return jsonResponse({ error: "Usuario criado no Auth, mas houve erro ao salvar o profile." }, 400);
    }

    await callerClient.rpc("portal_log_event", {
      p_action: "invite_user",
      p_entity_type: "portal_profiles",
      p_entity_id: targetUserId,
      p_details: { email },
    });

    return jsonResponse({ ok: true, message: "Convite enviado. O usuario recebera um e-mail para criar sua senha de acesso." });
  }

  if (action === "resend_reset") {
    await adminClient.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });

    await callerClient.rpc("portal_log_event", {
      p_action: "resend_password_reset",
      p_entity_type: "portal_profiles",
      p_entity_id: null,
      p_details: { email },
    });

    return jsonResponse({ ok: true, message: "Se este e-mail estiver cadastrado, um link de redefinicao foi enviado." });
  }

  return jsonResponse({ error: "Acao invalida." }, 400);
});
