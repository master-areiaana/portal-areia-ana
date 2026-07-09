# Portal Areia Ana

Portal de acessos com login individual via Supabase Auth, permissões por usuário, permissões por card/link e aba Controle de Acessos.

## Branch de trabalho

As alterações foram preparadas na branch:

```bash
ajuste-supabase-acessos-alcadas
```

A `main` não deve ser alterada até validação completa.

## O que foi preparado

- Remoção da dependência de senha única fixa no front-end.
- Login por usuário e senha na interface do portal.
- O e-mail continua existindo internamente para convite, recuperação de senha e Supabase Auth.
- Busca do contexto do usuário via função `portal_get_my_context()`.
- Exibição somente das abas e cards permitidos.
- Aba Controle de Acessos para gerenciar usuários, status, permissões por usuário, links do portal e logs.
- Fluxo de convite de acesso via Edge Function, sem expor `service_role_key` no navegador.
- Recuperação de senha pelo próprio portal.
- Soft delete de acesso com status `excluido`, sem apagar o usuário do Supabase Auth.
- Usuários excluídos ficam ocultos por padrão na lista principal, com opção de mostrar excluídos para consulta/reativação.
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
supabase/functions/portal-admin-user/index.ts
supabase/enable_username_login.sql
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
7. Execute `supabase/enable_username_login.sql` para habilitar login por usuário.
8. Em `Authentication > URL Configuration`, configure:
   - Site URL: `https://master-areiaana.github.io/portal-areia-ana/`
   - Redirect URLs: adicione a mesma URL acima.
9. Publique a Edge Function `supabase/functions/portal-admin-user/index.ts` (Edge Functions > Deploy a new function).

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

## Login por usuário e senha

A tela principal mostra apenas:

```text
Usuário
Senha
```

O Supabase Auth continua usando e-mail internamente. Para permitir login por usuário, o arquivo `supabase/enable_username_login.sql` cria:

- coluna `portal_profiles.username`;
- índice único para `username`;
- função `portal_resolve_login_identifier(p_identifier text)`.

Fluxo:

1. O suporte cadastra o e-mail para convite e recuperação.
2. O suporte define o campo **Usuário** no cadastro.
3. O funcionário entra no portal usando **Usuário + Senha**.
4. O sistema resolve internamente esse usuário para o e-mail do Supabase Auth.
5. A senha continua sendo a senha segura do Supabase Auth, criada pelo próprio funcionário.

O login por e-mail continua funcionando como fallback técnico, mas a interface operacional passa a mostrar **Usuário**.

## Perfis de acesso

- **suporte**: único perfil com `is_admin = true`. Acesso total real ao portal, incluindo a aba **Controle de Acessos**. É quem cria/libera usuários, altera permissões por usuário, mantém links, acompanha logs e bloqueia/desbloqueia/exclui acessos.
- **admin** (Admin / Diretoria): perfil legado da Diretoria, com `is_admin = false`. Mantém acesso às abas normais quando liberado, mas **não** acessa a aba Controle de Acessos.
- **diretoria**: mesmo padrão do perfil admin, também sem acesso à aba Controle de Acessos.
- Demais perfis (**gestao, comercial, cobranca, rh, operacional, consulta**): podem servir como perfil base/agrupador, mas a liberação operacional dos acessos é feita por usuário.

A aba mantém o código interno `admin` no banco de dados por compatibilidade, mas é exibida na tela como **"Controle de Acessos"**.

## Controle de Acessos

A área de suporte foi organizada para foco em cadastro individual:

- **Usuários**: cadastro/liberação de usuários, usuário de login, e-mail de convite, status, alteração de senha por e-mail e exclusão de acesso.
- **Permissões por Usuário**: tela principal de liberação. Define exatamente quais abas/cards uma pessoa específica pode acessar.
- **Logs**: histórico/auditoria de ações do portal.
- **Links do Portal**: manutenção dos links/cards existentes, como título, subtítulo, sensibilidade e ativo/inativo. Esta aba não é usada para liberar acesso.

Regra conceitual:

```text
Permissões por Usuário = quem acessa o quê.
Perfil base = agrupador/categoria do usuário.
Links do Portal = quais links/cards existem no portal.
```

A antiga tela de **Permissões por Perfil** não aparece mais na navegação principal, porque a liberação prática será por cadastro/usuário.

## Como cadastrar ou liberar usuários

Os funcionários nunca acessam o Supabase diretamente. Todo o fluxo é feito pelo próprio portal:

1. Entre no portal com um usuário do perfil **suporte**.
2. Vá em Controle de Acessos > Usuários.
3. Preencha:
   - e-mail para convite/recuperação;
   - usuário de login;
   - nome;
   - perfil base;
   - status;
   - cargo, área, unidade, gestor, validade e observações, se aplicável.
4. Clique em **Enviar convite de acesso**.
5. O sistema chama a Edge Function `portal-admin-user`, que cria ou localiza o usuário no Supabase Auth, salva o profile e envia um e-mail oficial do Supabase para o funcionário criar a própria senha.
6. Se o usuário já existir no Auth, o portal cria/atualiza o `portal_profiles` e envia um link de alteração de senha.
7. Depois do cadastro/liberação, vá em **Permissões por Usuário** para marcar exatamente quais abas e cards aquela pessoa poderá acessar.
8. O funcionário recebe o e-mail, cria a senha e depois entra no portal usando **Usuário + Senha**.

O suporte nunca vê, digita ou define a senha de nenhum usuário.

## Permissões por Usuário

A aba **Permissões por Usuário** usa a tabela `portal_user_permissions`.

Ela permite:

- escolher um usuário específico;
- marcar/desmarcar a aba inteira;
- marcar/desmarcar cards dentro da aba;
- liberar cards que o perfil base não teria;
- bloquear cards que o perfil base teria;
- limpar permissões individuais para o usuário voltar a seguir somente o perfil base.

Quando uma permissão individual existe, ela prevalece sobre a permissão do perfil base. Assim, o usuário verá a mesma estrutura visual do portal, mas somente as abas/cards marcados para ele ficarão disponíveis.

## Exclusão de acesso

Na lista de usuários cadastrados, o suporte pode usar **Excluir acesso**.

A exclusão é um soft delete:

- `portal_profiles.status` passa para `excluido`.
- O usuário do Supabase Auth não é apagado.
- O histórico e os logs são mantidos.
- O usuário deixa de acessar o portal porque somente `status = ativo` libera entrada.
- O usuário excluído fica oculto por padrão na lista principal de usuários cadastrados.
- O suporte pode clicar em **Mostrar excluídos** para consultar ou reativar acessos excluídos.
- O acesso pode ser liberado novamente no futuro alterando o status para `ativo` ou enviando novo convite pelo formulário.

Proteções obrigatórias:

- O suporte não consegue excluir o próprio usuário logado.
- O acesso `portalcore.consult@gmail.com` é protegido contra exclusão pela interface e pela Edge Function.
- A validação real fica na Edge Function, não apenas no front-end.

## Recuperação e alteração de senha

Na tela de login existe o link **Esqueci minha senha**:

1. O usuário informa o e-mail.
2. O portal chama `supabase.auth.resetPasswordForEmail(...)`, usando somente a `anonKey` pública.
3. É sempre exibida a mesma mensagem, exista ou não o e-mail cadastrado: "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha."
4. Ao clicar no link recebido, o usuário volta para o portal, que detecta o evento de recuperação e mostra a tela **Criar nova senha**.
5. Ao salvar, o portal chama `supabase.auth.updateUser({ password })` e exibe "Senha atualizada com sucesso. Faça login novamente."

Dentro da aba Controle de Acessos, o suporte pode clicar em **Alterar senha** ao lado de qualquer usuário. Esse botão apenas envia um link para o usuário criar uma nova senha. O suporte nunca deve ver, digitar, enviar ou definir senha para o usuário.

## Limite de envio de e-mail

O provedor padrão de e-mail do Supabase tem limite baixo de envio. No projeto atual foi identificado limite de 2 e-mails por hora.

A Edge Function trata erro `429`/rate limit e retorna mensagem segura para o front-end:

```text
Limite de envio de e-mails atingido. Aguarde alguns minutos ou configure SMTP proprio.
```

Para produção, configure SMTP próprio em `Authentication > Emails > SMTP Settings`, por exemplo Resend, SendGrid, Postmark, Amazon SES ou SMTP corporativo.

## Edge Function portal-admin-user

Local do código-fonte:

```text
supabase/functions/portal-admin-user/index.ts
```

Essa função roda no servidor do Supabase (nunca no navegador) e é a única parte do sistema que usa a `service_role_key` (lida somente de variáveis de ambiente do próprio Supabase, nunca hardcoded). Ela:

- Recebe o JWT do usuário logado que fez a chamada.
- Confirma no banco que quem chamou está com status `ativo` e tem perfil `suporte` com `is_admin = true`.
- Cria ou localiza o usuário no Supabase Auth e envia o e-mail de convite ou de alteração de senha, conforme o caso.
- Atualiza `portal_profiles` usando a RPC `portal_admin_upsert_profile_by_email`.
- Executa soft delete de acesso com `status = excluido` quando solicitado.
- Registra logs em `portal_audit_logs`.
- Trata limite de e-mail do Supabase e retorna erro seguro para o front-end.

## Limite importante

O portal controla a exibição de abas/cards e o acesso inicial. Links externos como Power BI, ClickUp, Topcon, RH Gestor e outros também precisam ter permissões revisadas dentro dos próprios sistemas.

Esconder um link no portal não bloqueia uma pessoa que já tenha o link direto e permissão no sistema externo.

## Deploys

Existem dois deploys diferentes:

1. **SQL/Supabase**: precisa executar `supabase/enable_username_login.sql` para login por usuário funcionar.
2. **Edge Function**: precisa ser publicada no Supabase quando `supabase/functions/portal-admin-user/index.ts` mudar.
3. **GitHub Pages**: precisa rodar o workflow `Deploy static content to Pages` na branch `ajuste-supabase-acessos-alcadas` para atualizar o front-end publicado.

Não faça merge na `main` antes de validar.

## Testes mínimos

- Tela de login mostra Usuário + Senha.
- Login por e-mail continua funcionando como fallback.
- Depois de executar `enable_username_login.sql`, login por usuário funciona.
- Suporte entra e vê Controle de Acessos.
- Controle de Acessos mostra Usuários, Permissões por Usuário, Logs e Links do Portal.
- Permissões por Perfil não aparece mais na navegação principal.
- Usuários mostra campo Usuário de login.
- Permissões por Usuário permite selecionar um usuário e marcar/desmarcar abas/cards específicos.
- Permissões por Usuário prevalece sobre o perfil base.
- Admin/Diretoria entra e vê somente os acessos liberados, sem Controle de Acessos.
- Usuário inativo/bloqueado/excluido não acessa.
- Botões Enviar convite, Alterar senha, Salvar e Excluir acesso travam durante a requisição e não aceitam duplo clique.
- Alterar senha pede confirmação antes de enviar o link.
- Erro de limite de e-mail aparece como mensagem amigável.
- Excluir acesso muda o status para `excluido`, não apaga o Auth user e cria log.
- Usuários excluídos ficam ocultos por padrão na lista principal.
- Botão Mostrar excluídos exibe os excluídos para consulta/reativação.
- Reativar usuário excluído funciona alterando status para `ativo` ou enviando novo convite.
- Links do Portal serve apenas para manutenção dos links/cards, não para liberação de acesso.
- Logout funciona.
- Modo claro/escuro continua funcionando.
- Links existentes continuam abrindo.
