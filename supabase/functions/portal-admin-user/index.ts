// Edge Function: portal-admin-user
// Cria/localiza usuarios no Supabase Auth e atualiza o portal_profiles.
// Usuarios com perfil suporte, admin ou diretoria ativos podem chamar esta funcao.
// A service_role_key e usada apenas aqui dentro, nunca no front-end.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://master-areiaana.github.io/portal-areia-ana/";
const PROTECTED_SUPPORT_EMAIL = "portalcore.consult@gmail.com";
const MANAGER_ROLES = ["suporte", "admin", "diretoria"];

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

function errorMessage(error) {
  return String(error?.message || error?.error_description || error?.error || "");
}

function errorStatus(error) {
  return Number(error?.status || error?.statusCode || error?.code || 0);
}

function isRateLimitError(error) {
  const msg = errorMessage(error);
  return errorStatus(error) === 429 || /rate\s*limit|too many|email rate limit/i.test(msg);
}

function rateLimitResponse() {
  return jsonResponse(
    {
      error: "email_rate_limit",
      message: "Limite de envio de e-mails atingido. Aguarde alguns minutos ou configure SMTP proprio.",
    },
    429,
  );
}

async function findUserByEmail(adminClient, email) {
  for (let page = 1; page <= 10; page += 1) {
    const listRes = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (listRes.error) throw listRes.error;
    const users = (listRes.data && listRes.data.users) || [];
    const found = users.find((u) => (u.email || "").toLowerCase() === email);
    if (found) return found;
    if (users.length < 1000) break;
  }
  return null;
}

async function logAction(adminClient, actorUserId, action, entityType, entityId, details = {}) {
  await adminClient.from("portal_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
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
  const callerEmail = String(authData.user.email || "").toLowerCase();

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const profileRes = await adminClient
    .from("portal_profiles")
    .select("status, role_id, validade_acesso")
    .eq("id", callerId)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const activeByDate = !profileRes.data?.validade_acesso || String(profileRes.data.validade_acesso).slice(0, 10) >= today;
  if (profileRes.error || !profileRes.data || profileRes.data.status !== "ativo" || !activeByDate) {
    return jsonResponse({ error: "Acesso negado." }, 403);
  }

  const roleRes = await adminClient
    .from("portal_roles")
    .select("codigo, is_admin")
    .eq("id", profileRes.data.role_id)
    .maybeSingle();

  const roleCodigo = String(roleRes.data?.codigo || "").toLowerCase();
  const canManageAccess = MANAGER_ROLES.includes(roleCodigo) && (roleCodigo !== "suporte" || roleRes.data?.is_admin === true);
  if (roleRes.error || !roleRes.data || !canManageAccess) {
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
  if (email === PROTECTED_SUPPORT_EMAIL) {
    return jsonResponse({ error: "A conta tecnica protegida nao pode ser alterada por esta tela." }, 403);
  }

  try {
    if (action === "invite") {
      const nome = body.nome ? String(body.nome).trim() : "";
      const roleCodigoTarget = body.role_codigo ? String(body.role_codigo).trim() : "";
      const status = body.status ? String(body.status).trim() : "ativo";
      const cargo = body.cargo || null;
      const area = body.area || null;
      const unidade = body.unidade || null;
      const gestor = body.gestor || null;
      const validade = body.validade_acesso || null;
      const observacoes = body.observacoes || null;
      const allowedStatus = ["ativo", "inativo", "bloqueado", "excluido"];

      if (!nome || !roleCodigoTarget) {
        return jsonResponse({ error: "Nome e perfil sao obrigatorios." }, 400);
      }
      if (!allowedStatus.includes(status)) {
        return jsonResponse({ error: "Status invalido." }, 400);
      }

      let targetUserId = null;
      let emailWarning = null;
      const inviteRes = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL });

      if (inviteRes.error) {
        const msg = errorMessage(inviteRes.error);
        const alreadyExists = /already registered|already exists|already been registered/i.test(msg);
        if (isRateLimitError(inviteRes.error)) {
          return rateLimitResponse();
        }
        if (!alreadyExists) {
          return jsonResponse({ error: "Nao foi possivel enviar o convite." }, 400);
        }

        const existing = await findUserByEmail(adminClient, email);
        if (!existing) return jsonResponse({ error: "Nao foi possivel localizar o usuario." }, 400);
        targetUserId = existing.id;

        const resetRes = await adminClient.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
        if (resetRes.error) {
          if (isRateLimitError(resetRes.error)) {
            emailWarning = "email_rate_limit";
          } else {
            emailWarning = "email_send_failed";
          }
        }
      } else {
        targetUserId = (inviteRes.data && inviteRes.data.user && inviteRes.data.user.id) || null;
      }

      const upsertRes = await callerClient.rpc("portal_admin_upsert_profile_by_email", {
        p_email: email,
        p_nome: nome,
        p_role_codigo: roleCodigoTarget,
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

      await logAction(adminClient, callerId, "invite_user", "portal_profiles", targetUserId, {
        email,
        role_codigo: roleCodigoTarget,
        status,
        email_warning: emailWarning,
      });

      if (emailWarning === "email_rate_limit") {
        return jsonResponse({
          ok: true,
          warning: "email_rate_limit",
          message: "Acesso atualizado, mas o e-mail nao foi enviado porque o limite de envio foi atingido. Aguarde e tente reenviar depois.",
        });
      }
      if (emailWarning === "email_send_failed") {
        return jsonResponse({
          ok: true,
          warning: "email_send_failed",
          message: "Acesso atualizado, mas o e-mail de redefinicao nao foi enviado. Tente reenviar depois.",
        });
      }

      return jsonResponse({ ok: true, message: "Convite enviado. O usuario recebera um e-mail para criar sua senha de acesso." });
    }

    if (action === "resend_reset") {
      const resetRes = await adminClient.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
      if (resetRes.error) {
        if (isRateLimitError(resetRes.error)) {
          await logAction(adminClient, callerId, "resend_password_reset_rate_limited", "portal_profiles", null, { email });
          return rateLimitResponse();
        }
        return jsonResponse({ error: "Nao foi possivel reenviar o e-mail de redefinicao." }, 400);
      }

      await logAction(adminClient, callerId, "resend_password_reset", "portal_profiles", null, { email });
      return jsonResponse({ ok: true, message: "Se este e-mail estiver cadastrado, um link de redefinicao foi enviado." });
    }

    if (action === "delete_access") {
      if (email === callerEmail || email === PROTECTED_SUPPORT_EMAIL) {
        return jsonResponse({ error: "Nao e permitido excluir este acesso protegido." }, 403);
      }

      const targetProfileRes = await adminClient
        .from("portal_profiles")
        .select("id, email, status")
        .eq("email", email)
        .maybeSingle();

      if (targetProfileRes.error) {
        return jsonResponse({ error: "Nao foi possivel localizar o acesso." }, 400);
      }
      if (!targetProfileRes.data) {
        return jsonResponse({ ok: true, message: "Este usuario ja nao possui acesso liberado no portal." });
      }

      const updateRes = await adminClient
        .from("portal_profiles")
        .update({ status: "excluido", updated_at: new Date().toISOString() })
        .eq("id", targetProfileRes.data.id);

      if (updateRes.error) {
        return jsonResponse({ error: "Nao foi possivel excluir o acesso." }, 400);
      }

      await logAction(adminClient, callerId, "delete_access", "portal_profiles", targetProfileRes.data.id, {
        email,
        previous_status: targetProfileRes.data.status,
        new_status: "excluido",
      });

      return jsonResponse({ ok: true, message: "Acesso excluido. O usuario nao podera mais acessar o portal." });
    }

    return jsonResponse({ error: "Acao invalida." }, 400);
  } catch (_e) {
    return jsonResponse({ error: "Erro interno ao processar a solicitacao." }, 500);
  }
});
