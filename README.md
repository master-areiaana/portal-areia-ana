# Portal Areia Ana

Portal de acessos com login individual via Supabase Auth, permissões por perfil, permissões por card/link e aba Admin.

## Branch de trabalho

As alterações foram preparadas na branch:

```bash
ajuste-supabase-acessos-alcadas
```

A `main` não deve ser alterada até validação completa.

## O que foi preparado

- Remoção da dependência de senha única fixa no front-end.
- Login por e-mail e senha via Supabase Auth.
- Busca do contexto do usuário via função `portal_get_my_context()`.
- Exibição somente das abas e cards permitidos.
- Aba Admin para gerenciar profiles, status, cards e permissões por perfil.
- Logs básicos em `portal_audit_logs`.
- Links atuais migrados para `portal_resources`.

## Arquivos principais

```text
index.html
assets/js/config.js
assets/js/config.example.js
assets/js/supabase-client.js
assets/js/auth.js
assets/js/portal.js
assets/js/admin.js
supabase/schema.sql
supabase/rls.sql
supabase/seed.sql
supabase/bootstrap_admin.sql
.env.example
```

## Configuração do Supabase

Crie um projeto Supabase exclusivo para este portal, preferencialmente chamado:

```text
portal-areia-ana
```

No painel do Supabase, execute nesta ordem:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/seed.sql`
4. Crie o primeiro usuário em `Authentication > Users`
5. Confirme em `supabase/bootstrap_admin.sql` o e-mail do usuário de Suporte (padrão: portalcore.consult@gmail.com)
6. Execute `supabase/bootstrap_admin.sql`
7. Em `Authentication > URL Configuration`, configure:
   - Site URL: `https://master-areiaana.github.io/portal-areia-ana/`
   - Redirect URLs: adicione a mesma URL acima.
8. Publique a Edge Function `supabase/functions/portal-admin-user/index.ts` (Edge Functions > Deploy a new function).

## Configuração do front-end

Edite:

```text
assets/js/config.js
```

Preencha:

```js
window.PORTAL_SUPABASE_CONFIG = {
  url: 'https://SEU-PROJECT-REF.supabase.co',
  anonKey: 'SUA_SUPABASE_ANON_KEY_PUBLICA'
};
```

A `anonKey` é pública por design. Nunca coloque `service_role_key` no front-end.

## Perfis de acesso

- **suporte**: único perfil com `is_admin = true`. Acesso total real ao portal, incluindo a aba **Controle de Acessos** (usuários, permissões, cards e logs). É quem cria/libera usuários, altera permissões e bloqueia/desbloqueia acessos.
- **admin** (Admin / Diretoria): perfil legado da Diretoria, com `is_admin = false`. Mantém acesso amplo às abas normais (Indicadores, Comercial, RH, Sistemas, Calendário), mas **não** acessa a aba Controle de Acessos e não pode gerenciar usuários/permissões.
- **diretoria**: mesmo padrão de acesso amplo do perfil admin, também sem acesso à aba Controle de Acessos.
- Demais perfis (**gestao, comercial, cobranca, rh, operacional, consulta**): seguem as permissões específicas já configuradas em `seed.sql`, sem qualquer acesso à aba Controle de Acessos.

A aba mantém o código interno `admin` no banco de dados por compatibilidade, mas é exibida na tela como **"Controle de Acessos"**.

## Como cadastrar novos usuários

Os funcionários nunca acessam o Supabase diretamente. Todo o fluxo é feito pelo próprio portal:

1. Entre no portal com um usuário do perfil **suporte**.
2. Vá na aba Controle de Acessos > Usuários.
3. Preencha nome, e-mail, perfil, status, cargo, área, unidade, gestor, validade e observações (se aplicável).
4. Clique em **Enviar convite de acesso**.
5. O sistema chama a Edge Function `portal-admin-user`, que cria ou localiza o usuário no Supabase Auth, salva o profile e envia um e-mail oficial do Supabase para o funcionário criar a própria senha.
6. O funcionário recebe o e-mail, clica no link, define a senha na tela **Criar nova senha** do próprio portal e depois faz login normalmente.

O suporte nunca vê, digita ou define a senha de nenhum usuário.

## Recuperação de senha

Na tela de login existe o link **Esqueci minha senha**:

1. O usuário informa o e-mail.
2. O portal chama `supabase.auth.resetPasswordForEmail(...)`, usando somente a `anonKey` pública.
3. É sempre exibida a mesma mensagem, exista ou não o e-mail cadastrado: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
4. Ao clicar no link recebido, o usuário volta para o portal, que detecta o evento de recuperação e mostra a tela **Criar nova senha** (nova senha + confirmação).
5. Ao salvar, o portal chama `supabase.auth.updateUser({ password })` e exibe "Senha atualizada com sucesso. Faça login novamente."

Dentro da aba Controle de Acessos, o suporte também pode clicar em **Reenviar redefinição** ao lado de qualquer usuário, para reenviar esse mesmo link de redefinição de senha.

## Edge Function portal-admin-user

Local do código-fonte:

```text
supabase/functions/portal-admin-user/index.ts
```

Essa função roda no servidor do Supabase (nunca no navegador) e é a única parte do sistema que usa a `service_role_key` (lida somente de variáveis de ambiente do próprio Supabase, nunca hardcoded). Ela:

- Recebe o JWT do usuário logado que fez a chamada.
- Confirma no banco (nunca confiando no payload enviado) que quem chamou está com status `ativo` e tem perfil `suporte` com `is_admin = true`. Qualquer outro perfil recebe "Acesso negado".
- Cria ou localiza o usuário no Supabase Auth e envia o e-mail de convite ou de redefinição, conforme o caso.
- Atualiza `portal_profiles` usando a RPC `portal_admin_upsert_profile_by_email`.
- Registra um log em `portal_audit_logs`.

## Limite importante

O portal controla a exibição de abas/cards e o acesso inicial. Links externos como Power BI, ClickUp, Topcon, RH Gestor e outros também precisam ter permissões revisadas dentro dos próprios sistemas.

Esconder um link no portal não bloqueia uma pessoa que já tenha o link direto e permissão no sistema externo.

## Testes mínimos

- Suporte entra e vê todas as abas, incluindo Controle de Acessos, e consegue gerenciar usuários/permissões/logs/cards.
- Admin/Diretoria entra e vê as abas normais, mas não vê nem acessa a aba Controle de Acessos.
- Comercial não vê RH/Controle de Acessos.
- Cobrança vê os cards liberados e não vê DRE, se não for liberado.
- RH vê RH e Calendário.
- Usuário inativo/bloqueado não acessa.
- Logout funciona.
- Modo claro/escuro continua funcionando.
- Links existentes continuam abrindo.
