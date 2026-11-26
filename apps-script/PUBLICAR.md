# Publicar o Apps Script do módulo Documentos

Faça tudo logada na conta **master@areiaana.com.br**, que é a dona da pasta "05. Doc. Areia Ana". Leva uns 10 minutos.

> Dica: abra uma janela anônima e entre só com a conta master. Assim o Google não mistura com outra conta.

## 1. Criar o projeto

1. Abra https://script.google.com e clique em **Novo projeto**.
2. Clique no nome **Projeto sem título**, no alto, e troque por **Portal - Documentos**.
3. Apague o conteúdo do arquivo `Código.gs` e cole o conteúdo inteiro de [`Documentos.gs`](Documentos.gs).
4. Clique no disquete (**Salvar projeto**).
5. Clique na engrenagem (**Configurações do projeto**), à esquerda:
   - em **Fuso horário**, escolha **(GMT-03:00) Horário de Brasília – São Paulo**;
   - confira que **Ativar o ambiente de execução do Chrome V8** está marcado.

## 2. Rodar a configuração inicial

1. Volte ao editor (ícone `< >`, à esquerda).
2. Na barra de cima, ao lado de **Depurar**, escolha a função **configurarInicial** e clique em **Executar**.
3. Vai aparecer **Autorização necessária**. Siga:
   1. clique em **Revisar permissões** e escolha a conta **master@areiaana.com.br**;
   2. se aparecer "O Google não verificou este app", clique em **Avançado** e depois em **Acessar Portal - Documentos (não seguro)**. O app é seu, por isso o aviso;
   3. clique em **Permitir**. O app pede para ver e editar o Drive, ver e editar planilhas e se conectar a serviço externo (o Supabase do portal).
4. No **Registro de execução**, embaixo, devem aparecer estas linhas:
   - `OK: pasta raiz sem compartilhamento por link.`
   - `OK: pasta _Excluidos: ...`
   - `OK: planilha de auditoria: https://docs.google.com/...` (a planilha **Portal - Documentos - Auditoria** fica no Meu Drive, fora da pasta dos documentos)
   - Se aparecer **ATENÇÃO**, me mande o print antes de seguir.
5. Opcional: escolha a função **testarSupabase** e clique em **Executar**. O esperado é uma **recusa** (401, 403 ou "permission denied"). Ela mostra que a conexão com o portal funciona e que ninguém entra sem login.

As **Propriedades do Script** já ficam preenchidas. Para conferir ou mudar: **Configurações do projeto → Propriedades do script**.

| Propriedade | O que é | Valor inicial |
|---|---|---|
| `PASTA_RAIZ_ID` | Pasta do Drive com os documentos | `1XWhC21kdsYMUsvp3wu1a-j6STW8AR3bi` |
| `PLANILHA_AUDITORIA_ID` | Planilha de auditoria | criada pela configuração |
| `PASTA_EXCLUIDOS_ID` | Subpasta `_Excluidos` | criada pela configuração |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Login do portal (a chave anon é pública) | as do portal |
| `TAMANHO_MAX_MB` | Limite para subir | `20` |
| `TAMANHO_MAX_BAIXAR_MB` | Limite para abrir ou baixar (arquivos postos direto no Drive podem ser maiores) | `30` |
| `ADMINS` | E-mails com poder de Administrador, além do perfil Administrador do portal (separe com vírgula) | vazio |
| `CACHE_LOGIN_SEG` | Por quantos segundos o mesmo login vale sem perguntar de novo ao Supabase (0 = pergunta sempre) | `60` |
| `LOG_LISTAGEM` | `sim` registra também cada abertura de pasta e cada busca. Os erros são sempre registrados | `nao` |

## 3. Publicar como Web App

1. No canto de cima, à direita, clique em **Implantar → Nova implantação**.
2. Na engrenagem ao lado de **Selecione o tipo**, escolha **App da Web**.
3. Preencha:
   - **Descrição:** `Documentos v1`
   - **Executar como:** **Eu (master@areiaana.com.br)**
   - **Quem pode acessar:** **Qualquer pessoa**
4. Clique em **Implantar** e, se pedir, autorize de novo.
5. Copie a **URL do app da Web**. Ela termina em `/exec`. **Me envie essa URL**: eu coloco no portal e preparo a pré-visualização.

> **Se "Qualquer pessoa" não aparecer**, e só houver "Qualquer pessoa em areiaana.com.br", o administrador do Google Workspace bloqueou essa opção. **Não publique** com a opção restrita: o portal não vai conseguir chamar o script. Peça ao administrador do Workspace para liberar em: Admin Console → Apps → Google Workspace → Drive e Documentos → Configurações de compartilhamento → permitir compartilhar fora do domínio. Ou me avise para buscarmos outra saída.

"Qualquer pessoa" é seguro neste caso porque o script recusa qualquer chamada sem login válido do portal. Essas recusas também ficam registradas na aba Log.

## 4. Depois de publicado

- **Ver o que aconteceu:** abra a planilha **Portal - Documentos - Auditoria**, aba **Log**.
- **Recuperar um arquivo excluído:** no Drive, abra `05. Doc. Areia Ana/_Excluidos`, veja na descrição do arquivo (botão ⓘ) a pasta de origem e arraste o arquivo de volta.
- **Atualizar o código:** cole o código novo, salve e vá em **Implantar → Gerenciar implantações → ✏️ (editar) → Versão: Nova versão → Implantar**. **Não** crie uma "Nova implantação", senão a URL muda.
- **Nunca** compartilhe a pasta "05. Doc. Areia Ana" por link. Quem precisa de acesso usa o portal.
