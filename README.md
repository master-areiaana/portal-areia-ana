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
5. Edite `supabase/bootstrap_admin.sql` trocando o e-mail de exemplo pelo e-mail real do primeiro Admin
6. Execute `supabase/bootstrap_admin.sql`

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

## Como cadastrar novos usuários na v1

1. Acesse Supabase > Authentication > Users.
2. Crie o usuário com e-mail e senha provisória.
3. Entre no portal com um usuário Admin.
4. Vá em Admin > Usuários.
5. Cadastre o profile usando o mesmo e-mail criado no Supabase Auth.
6. Escolha perfil e status.

## Limite importante

O portal controla a exibição de abas/cards e o acesso inicial. Links externos como Power BI, ClickUp, Topcon, RH Gestor e outros também precisam ter permissões revisadas dentro dos próprios sistemas.

Esconder um link no portal não bloqueia uma pessoa que já tenha o link direto e permissão no sistema externo.

## Testes mínimos

- Admin entra e vê todas as abas, incluindo Admin.
- Comercial não vê RH/Admin.
- Cobrança vê os cards liberados e não vê DRE, se não for liberado.
- RH vê RH e Calendário.
- Usuário inativo/bloqueado não acessa.
- Logout funciona.
- Modo claro/escuro continua funcionando.
- Links existentes continuam abrindo.
