---
title: "Manual Executável e Especificação da CLI OpenCode"
slug: "opencode-cli"
version: 1.1.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Especificação Técnica e Manual da CLI OpenCode

> **Ambiente verificado:** OpenCode `1.18.25`, Linux x64  
> **Data da verificacao:** 2026-08-31  
> **Tipo:** Manual de utilizacao (MAN)  
> **Versao do documento:** 1.1  
> **Fontes:** CLI local (`opencode ... --help`) e documentacao oficial  
> **Escopo:** comandos executados no shell; comandos internos do TUI aparecem apenas no apendice

---

## Sumario

1. [Como ler as transcricoes](#1-como-ler-as-transcricoes)
2. [Descoberta e flags globais](#2-descoberta-e-flags-globais)
3. [TUI: opencode](#3-tui-opencode)
4. [Completion](#4-completion)
5. [Agentes](#5-agentes-opencode-agent)
6. [Providers e autenticacao](#6-providers-e-autenticacao-opencode-providers--auth)
7. [Modelos](#7-modelos-opencode-models)
8. [Execucao nao interativa](#8-execucao-nao-interativa-opencode-run)
9. [Servidores e clientes](#9-servidores-e-clientes-serve-web-attach-e-acp)
10. [Sessoes](#10-sessoes-opencode-session)
11. [Estatisticas](#11-estatisticas-opencode-stats)
12. [Exportacao e importacao](#12-exportacao-e-importacao)
13. [MCP](#13-mcp-opencode-mcp)
14. [Plugins](#14-plugins-opencode-plugin)
15. [GitHub e pull requests](#15-github-e-pull-requests)
16. [Banco de dados](#16-banco-de-dados-opencode-db)
17. [Depuracao](#17-depuracao-opencode-debug)
18. [Atualizacao e desinstalacao](#18-atualizacao-e-desinstalacao)
19. [Plano de utilizacao](#19-plano-de-utilizacao)
20. [Variaveis de ambiente](#20-variaveis-de-ambiente)
21. [Apendice: comandos internos do TUI](#21-apendice-comandos-internos-do-tui)

---

## 1. Como ler as transcricoes

Todo exemplo usa um bloco `bash` como se o usuario estivesse diante do terminal:

```bash
$ comando digitado pelo usuario
saida produzida pelo comando
```

### Legenda das saidas

| Marcador | Significado |
|---|---|
| **Saida capturada** | Texto realmente retornado pelo OpenCode `1.18.25` nesta maquina |
| **Saida representativa** | Estrutura real da resposta, mas valores entre `<...>` variam por maquina, projeto, provider ou sessao |
| **Interface interativa** | O comando abre TUI, navegador, seletor ou prompt; nao existe uma saida estatica unica |
| **Nao executado** | Comando mutavel, destrutivo, remoto ou dependente de credencial; o manual mostra o fluxo esperado sem realiza-lo |

> [!IMPORTANT]
> Uma "resposta exata" universal nao existe para comandos que consultam sessoes, modelos, custos, arquivos, credenciais ou respostas de LLM. Nesses casos, este manual mostra exatamente o **formato** retornado e marca dados variaveis com `<...>`. Saidas declaradas como **capturadas** foram obtidas da instalacao local.

**Regra de leitura:** somente blocos introduzidos explicitamente por **Saida capturada** sao transcricoes literais desta maquina. Todos os demais blocos sao **saidas representativas**, mesmo quando a ferramenta pode mudar apenas uma palavra, cor ANSI, caminho, ID ou mensagem entre versoes.

> [!CAUTION]
> Nunca cole tokens reais em exemplos, historico do shell ou documentacao. Use variaveis de ambiente ou placeholders como `<TOKEN>`.

---

## 2. Descoberta e flags globais

### 2.1 Ver a versao instalada

**Saida capturada:**

```bash
$ opencode --version
1.18.25
```

Forma curta equivalente:

```bash
$ opencode -v
1.18.25
```

### 2.2 Ver todos os comandos disponiveis

```bash
$ opencode --help
Commands:
  opencode completion          generate shell completion script
  opencode acp                 start ACP (Agent Client Protocol) server
  opencode mcp                 manage MCP (Model Context Protocol) servers
  opencode [project]           start opencode tui
  opencode attach <url>        attach to a running opencode server
  opencode run [message..]     run opencode with a message
  opencode debug               debugging and troubleshooting tools
  opencode providers           manage AI providers and credentials [aliases: auth]
  opencode agent               manage agents
  opencode upgrade [target]    upgrade opencode
  opencode uninstall           uninstall opencode
  opencode serve               starts a headless opencode server
  opencode web                 start opencode server and open web interface
  opencode models [provider]   list all available models
  opencode stats               show token usage and cost statistics
  opencode export [sessionID]  export session data as JSON
  opencode import <file>       import session data from JSON file or URL
  opencode github              manage GitHub agent
  opencode pr <number>         fetch and checkout a GitHub PR branch
  opencode session             manage sessions
  opencode plugin <module>     install plugin and update config [aliases: plug]
  opencode db                  database tools
```

### 2.3 Flags globais

| Flag | Uso |
|---|---|
| `-h`, `--help` | mostra ajuda contextual |
| `-v`, `--version` | mostra a versao |
| `--print-logs` | escreve logs no `stderr` |
| `--log-level DEBUG\|INFO\|WARN\|ERROR` | seleciona o nivel de log |
| `--pure` | inicia sem plugins externos |

#### Ciclo: diagnosticar inicializacao com logs

**Saida representativa:**

```bash
$ opencode --print-logs --log-level DEBUG
INFO  ... service=default cwd=/caminho/do/projeto
DEBUG ... loading config from /home/<usuario>/.config/opencode/opencode.jsonc
DEBUG ... loading plugin file:///home/<usuario>/.config/opencode/plugins/<plugin>.js
<o TUI ocupa a tela apos a inicializacao>
```

#### Ciclo: isolar problemas causados por plugin

```bash
$ opencode --pure
<o TUI abre sem carregar plugins externos>
```

Se o erro desaparece com `--pure`, investigue os plugins locais ou npm.

---

## 3. TUI: `opencode`

### 3.1 Abrir no diretorio atual

```bash
$ opencode
<a interface TUI ocupa o terminal; nao ha saida textual estatica>
```

### 3.2 Abrir um projeto especifico

```bash
$ opencode /home/albano/projetos/minha-api
<o TUI abre usando /home/albano/projetos/minha-api como projeto>
```

### 3.3 Continuar ou bifurcar sessoes

```bash
$ opencode --continue
<o TUI abre a sessao mais recente>

$ opencode --session ses_abc123
<o TUI abre a sessao ses_abc123>

$ opencode --session ses_abc123 --fork
<o TUI abre uma nova sessao bifurcada de ses_abc123>
```

### 3.4 Escolher modelo, agente e prompt inicial

```bash
$ opencode --model anthropic/claude-sonnet-4-6 \
    --agent build-guarded \
    --prompt "Revise o estado atual do projeto"
<o TUI abre com modelo, agente e prompt informados>
```

### 3.5 Autoaprovar permissoes nao negadas

```bash
$ opencode --auto
<o TUI abre; permissoes sem regra deny explicita sao aprovadas automaticamente>
```

> [!WARNING]
> `--auto` e perigoso em projetos reais. Regras `deny` continuam valendo, mas regras `ask` deixam de solicitar confirmacao.

### 3.6 Interface minima e replay

Flags locais confirmadas em `1.18.25`:

```bash
$ opencode --mini
<abre a interface interativa minima>

$ opencode --mini --no-replay
<abre a interface minima sem reproduzir o historico ao retomar/redimensionar>

$ opencode --mini --replay-limit 20
<abre a interface minima e limita o replay visual às 20 mensagens mais novas>
```

### 3.7 Servidor embutido da TUI

```bash
$ opencode --hostname 127.0.0.1 --port 4096 \
    --cors http://localhost:3000
<o TUI abre e o backend escuta em 127.0.0.1:4096>
```

Com descoberta mDNS:

```bash
$ opencode --mdns --mdns-domain opencode.local
<o TUI abre; o backend e anunciado por mDNS>
```

---

## 4. Completion

`opencode completion` gera um script de autocomplete para Bash no `stdout`.

### 4.1 Inspecionar a saida

**Saida capturada, abreviada apenas no corpo da funcao:**

```bash
$ opencode completion
###-begin-opencode-completions-###
#
# yargs command completion script
#
# Installation: opencode completion >> ~/.bashrc
#    or opencode completion >> ~/.bash_profile on OSX.
#
_opencode_yargs_completions()
{
    ...
}
complete -o bashdefault -o default -F _opencode_yargs_completions opencode
###-end-opencode-completions-###
```

### 4.2 Instalar no Bash

```bash
$ opencode completion >> ~/.bashrc
<nenhuma saida: o script foi anexado ao arquivo>

$ source ~/.bashrc
<nenhuma saida em caso de sucesso>

$ opencode au<TAB>
auth
```

> [!NOTE]
> A ajuda local de `completion` em `1.18.25` mostra a ajuda raiz, mas a execucao gera corretamente o script Bash.

---

## 5. Agentes: `opencode agent`

### 5.1 Descobrir subcomandos

```bash
$ opencode agent --help
opencode agent

manage agents

Commands:
  opencode agent create  create a new agent
  opencode agent list    list all available agents
```

### 5.2 Listar agentes

```bash
$ opencode agent list
build (primary)
  [ <regras de permissao resolvidas> ]
plan (primary)
  [ <regras de permissao resolvidas> ]
explore (subagent)
  [ <regras de permissao resolvidas> ]
...
```

> [!NOTE]
> A saida real inclui a lista completa de permissoes resolvidas para cada agente e pode ser muito longa. Os nomes e regras variam conforme os arquivos globais e do projeto.

### 5.3 Criar agente interativamente

```bash
$ opencode agent create
<abre um assistente interativo para escolher escopo, descricao, modo, permissoes e modelo>
```

### 5.4 Criar agente sem interacao

Todas as opcoes especificas aparecem neste ciclo:

```bash
$ opencode agent create \
    --path .opencode/agents \
    --description "Revisa seguranca sem editar arquivos" \
    --mode subagent \
    --permissions read,glob,grep,webfetch \
    --model anthropic/claude-sonnet-4-6
<arquivo do novo agente criado em .opencode/agents/>
```

`--tools` e alias de `--permissions`:

```bash
$ opencode agent create \
    --path .opencode/agents \
    --description "Explora o repositorio" \
    --mode subagent \
    --tools read,glob,grep \
    --model anthropic/claude-haiku-4-5
<arquivo do agente criado; permissoes omitidas sao negadas>
```

Modos aceitos: `all`, `primary`, `subagent`. Permissoes aceitas: `bash`, `read`, `edit`, `glob`, `grep`, `webfetch`, `task`, `todowrite`, `websearch`, `lsp`, `skill`.

---

## 6. Providers e autenticacao: `opencode providers` / `auth`

Na versao `1.18.25`, `providers` e o nome principal e `auth` e alias. Ambos funcionam:

```bash
$ opencode providers --help
opencode providers

manage AI providers and credentials

Commands:
  opencode auth list               list providers and credentials [aliases: ls]
  opencode auth login [url]        log in to a provider
  opencode auth logout [provider]  log out from a configured provider
```

### 6.1 Login interativo

```bash
$ opencode auth login
<abre seletor interativo de provider e metodo>
```

### 6.2 Login por provider e metodo

```bash
$ opencode auth login --provider anthropic
<solicita o metodo e depois a credencial do provider anthropic>

$ opencode auth login -p openai -m api
<solicita a credencial usando diretamente o metodo api>
```

Tambem e aceito um URL posicional de provider:

```bash
$ opencode auth login https://<servidor-de-autenticacao>
<inicia o fluxo definido pelo URL>
```

> [!CAUTION]
> A entrada da credencial nao deve ser copiada para logs, Markdown ou historico do shell.

### 6.3 Listar providers autenticados

```bash
$ opencode auth list
Credentials ~/.local/share/opencode/auth.json

● <provider-1> <metodo>
● <provider-2> <metodo>
```

Alias equivalente:

```bash
$ opencode auth ls
<a mesma lista retornada por opencode auth list>
```

### 6.4 Logout

```bash
$ opencode auth logout anthropic
Logged out from anthropic
```

Se o provider for omitido:

```bash
$ opencode auth logout
<abre seletor dos providers configurados>
```

---

## 7. Modelos: `opencode models`

### 7.1 Todos os modelos configurados

```bash
$ opencode models
anthropic/<modelo-1>
anthropic/<modelo-2>
openai/<modelo-1>
...
```

### 7.2 Filtrar por provider

```bash
$ opencode models anthropic
anthropic/<modelo-1>
anthropic/<modelo-2>
...
```

### 7.3 Mostrar metadados e custos

```bash
$ opencode models anthropic --verbose
anthropic/<modelo>
  Name: <nome legivel>
  Context: <limite de contexto>
  Input: $<custo>
  Output: $<custo>
```

### 7.4 Atualizar cache de `models.dev`

```bash
$ opencode models --refresh
<atualiza o cache e imprime a lista vigente de provider/model>
```

---

## 8. Execucao nao interativa: `opencode run`

`run` envia uma mensagem sem abrir o TUI completo.

### 8.1 Resposta formatada

```bash
$ opencode run "Responda somente com a palavra OK"
OK
```

> [!NOTE]
> Respostas de LLM sao nao deterministicas. O texto acima e o resultado pretendido pelo prompt, nao uma garantia byte a byte.

### 8.2 Eventos JSON

```bash
$ opencode run --format json "Responda somente com OK"
{"type":"step_start","timestamp":<...>,"sessionID":"ses_<...>"}
{"type":"text","timestamp":<...>,"sessionID":"ses_<...>","part":{"text":"OK"}}
{"type":"step_finish","timestamp":<...>,"sessionID":"ses_<...>","part":{...}}
```

### 8.3 Modelo, variante, agente e titulo

```bash
$ opencode run \
    --model anthropic/claude-sonnet-4-6 \
    --variant high \
    --agent plan-refine \
    --title "Planejar autenticacao" \
    "Crie um plano para autenticacao"
<resposta do modelo selecionado; sessao salva com o titulo informado>
```

### 8.4 Anexar arquivos

```bash
$ opencode run \
    --file src/main.ts \
    --file src/main.test.ts \
    "Revise estes arquivos"
<analise dos dois arquivos>
```

### 8.5 Continuar, selecionar ou bifurcar sessao

```bash
$ opencode run --continue "Continue de onde parou"
<resposta adicionada a sessao mais recente>

$ opencode run --session ses_abc123 "Resuma o estado atual"
<resposta adicionada a ses_abc123>

$ opencode run --session ses_abc123 --fork "Explore uma alternativa"
<nova sessao criada a partir de ses_abc123; resposta vai para a bifurcacao>
```

### 8.6 Compartilhar, exibir thinking e autoaprovar

```bash
$ opencode run --share "Crie um resumo publico"
<resposta>
https://opncd.ai/s/<id-do-share>

$ opencode run --thinking "Resolva este problema"
<blocos de raciocinio suportados pelo modelo + resposta final>

$ opencode run --auto "Execute os testes permitidos"
<execucao sem prompts para permissoes que nao estejam explicitamente negadas>
```

### 8.7 Executar comando customizado

```bash
$ opencode run --command deploy "staging"
<executa o comando /deploy usando "staging" como argumento>
```

### 8.8 Definir diretorio e porta local

```bash
$ opencode run \
    --dir /home/albano/projetos/minha-api \
    --port 4097 \
    "Resuma o projeto"
<resumo gerado no contexto do diretorio informado>
```

### 8.9 Modo interativo direto

Flag local adicional em `1.18.25`:

```bash
$ opencode run --interactive "Comece revisando o projeto"
<abre modo interativo direto com rodape dividido>
```

### 8.10 Anexar a servidor existente

```bash
$ opencode run \
    --attach http://localhost:4096 \
    --username opencode \
    --password '<SENHA>' \
    --dir /home/albano/projetos/minha-api \
    "Execute uma revisao"
<resposta produzida pelo servidor remoto>
```

---

## 9. Servidores e clientes: `serve`, `web`, `attach` e `acp`

### 9.1 Servidor API headless

```bash
$ opencode serve --hostname 127.0.0.1 --port 4096
opencode server listening on http://127.0.0.1:4096
<processo permanece em primeiro plano; Ctrl+C encerra>
```

Com mDNS e CORS:

```bash
$ opencode serve \
    --mdns \
    --mdns-domain opencode.local \
    --cors http://localhost:3000 \
    --cors https://app.exemplo.test
<servidor inicia, anunciado por mDNS, aceitando as duas origens CORS>
```

Porta `0` solicita uma porta livre automaticamente:

```bash
$ opencode serve --port 0
opencode server listening on http://127.0.0.1:<porta-aleatoria>
```

### 9.2 Servidor com interface web

```bash
$ opencode web --hostname 127.0.0.1 --port 4096
opencode web available at http://127.0.0.1:4096
<o navegador padrao e aberto; o processo continua em primeiro plano>
```

`web` aceita as mesmas opcoes `--port`, `--hostname`, `--mdns`, `--mdns-domain` e `--cors` de `serve`.

### 9.3 Proteger servidor com auth basica

```bash
$ OPENCODE_SERVER_USERNAME=albano \
  OPENCODE_SERVER_PASSWORD='<SENHA>' \
  opencode serve --hostname 0.0.0.0 --port 4096
opencode server listening on http://0.0.0.0:4096
```

### 9.4 Anexar um TUI ao servidor

```bash
$ opencode attach http://127.0.0.1:4096
<o TUI abre conectado ao backend existente>

$ opencode attach http://127.0.0.1:4096 \
    --username albano \
    --password '<SENHA>' \
    --dir /home/albano/projetos/minha-api
<o TUI abre autenticado e usa o diretorio remoto informado>
```

Continuacao, fork e interface minima:

```bash
$ opencode attach http://127.0.0.1:4096 --continue
<abre a sessao mais recente do servidor>

$ opencode attach http://127.0.0.1:4096 --session ses_abc123 --fork
<abre nova sessao bifurcada de ses_abc123>

$ opencode attach http://127.0.0.1:4096 --mini --no-replay
<abre cliente minimo, sem replay visual>

$ opencode attach http://127.0.0.1:4096 --mini --replay-limit 20
<abre cliente minimo com no maximo 20 mensagens reproduzidas>
```

### 9.5 Servidor ACP

```bash
$ opencode acp --cwd /home/albano/projetos/minha-api
<servidor ACP aguarda mensagens nd-JSON por stdin/stdout>
```

ACP tambem aceita as opcoes de rede:

```bash
$ opencode acp \
    --cwd /home/albano/projetos/minha-api \
    --hostname 127.0.0.1 \
    --port 4098 \
    --mdns \
    --mdns-domain acp.local \
    --cors http://localhost:3000
<servidor ACP permanece em execucao>
```

---

## 10. Sessoes: `opencode session`

### 10.1 Listar em tabela

```bash
$ opencode session list --max-count 3 --format table
Session ID                    Title                         Updated
ses_<id-1>                    <titulo-1>                    <data/hora>
ses_<id-2>                    <titulo-2>                    <data/hora>
ses_<id-3>                    <titulo-3>                    <data/hora>
```

Forma curta:

```bash
$ opencode session list -n 3
<as 3 sessoes mais recentes em tabela>
```

### 10.2 Listar em JSON

**Formato capturado, com valores pessoais substituidos:**

```bash
$ opencode session list -n 1 --format json
[
  {
    "id": "ses_<id>",
    "title": "<titulo>",
    "updated": <epoch-milisegundos>,
    "created": <epoch-milisegundos>,
    "projectId": "<hash-do-projeto>",
    "directory": "/caminho/do/projeto"
  }
]
```

### 10.3 Excluir sessao

```bash
$ opencode session delete ses_abc123
Session ses_abc123 deleted
```

> [!WARNING]
> `session delete` remove os dados da sessao. Confirme o ID com `session list` antes.

---

## 11. Estatisticas: `opencode stats`

### 11.1 Todas as estatisticas

```bash
$ opencode stats
OpenCode Stats

Sessions       <total>
Messages       <total>
Input tokens   <total>
Output tokens  <total>
Cost           $<valor>
```

### 11.2 Periodo, ferramentas, modelos e projeto

Todas as opcoes podem ser combinadas:

```bash
$ opencode stats \
    --days 30 \
    --tools 10 \
    --models 5 \
    --project /home/albano/projetos/minha-api
OpenCode Stats (last 30 days)
<totais filtrados>

Top Tools
<ate 10 ferramentas>

Top Models
<ate 5 modelos>
```

Mostrar todos os modelos:

```bash
$ opencode stats --models
<estatisticas gerais e todos os modelos usados>
```

Filtrar pelo projeto atual usando string vazia:

```bash
$ opencode stats --project ''
<estatisticas apenas do projeto correspondente ao diretorio atual>
```

---

## 12. Exportacao e importacao

### 12.1 Exportar sessao no terminal

```bash
$ opencode export ses_abc123
{
  "info": { "id": "ses_abc123", "title": "<titulo>", ... },
  "messages": [ ... ]
}
```

Sem ID:

```bash
$ opencode export
<abre seletor interativo de sessoes; depois imprime o JSON escolhido>
```

### 12.2 Exportar para arquivo

```bash
$ opencode export ses_abc123 > sessao.json
<nenhuma saida no terminal; o JSON foi redirecionado para sessao.json>

$ opencode export ses_abc123 --sanitize > sessao-sanitizada.json
<nenhuma saida; transcript e dados de arquivo sensiveis sao redigidos>
```

### 12.3 Importar arquivo

```bash
$ opencode import sessao.json
Imported session: ses_<novo-id>
```

### 12.4 Importar URL compartilhado

```bash
$ opencode import https://opncd.ai/s/abc123
Imported session: ses_<novo-id>
```

---

## 13. MCP: `opencode mcp`

### 13.1 Listar servidores e status

**Saida capturada quando nao ha MCP configurado:**

```bash
$ opencode mcp list
┌  MCP Servers
│
▲  No MCP servers configured
│
└  Add servers with: opencode mcp add
```

Alias:

```bash
$ opencode mcp ls
<a mesma lista retornada por opencode mcp list>
```

### 13.2 Adicionar MCP local interativamente

```bash
$ opencode mcp add meu-servidor
<assistente pergunta se o MCP e local ou remoto e solicita command/configuracao>
```

Variaveis de ambiente locais podem ser repetidas:

```bash
$ opencode mcp add meu-servidor \
    --env NODE_ENV=development \
    --env LOG_LEVEL=info
<assistente conclui a configuracao local usando as variaveis fornecidas>
```

### 13.3 Adicionar MCP remoto

```bash
$ opencode mcp add docs \
    --url https://mcp.exemplo.test \
    --header 'Authorization=Bearer <TOKEN>' \
    --header 'X-Client=opencode'
MCP server "docs" added
```

> [!CAUTION]
> Prefira referenciar secrets por ambiente/configuracao segura; o token literal pode ficar no historico do shell.

### 13.4 Autenticar MCP OAuth

```bash
$ opencode mcp auth docs
Opening browser for OAuth authentication...
Authentication successful for "docs"
```

Sem nome:

```bash
$ opencode mcp auth
<abre seletor dos MCPs OAuth disponiveis>
```

### 13.5 Listar status OAuth

```bash
$ opencode mcp auth list
<lista MCPs OAuth e informa authenticated/not authenticated>

$ opencode mcp auth ls
<mesma saida>
```

### 13.6 Remover OAuth

```bash
$ opencode mcp logout docs
OAuth credentials removed for "docs"
```

### 13.7 Depurar OAuth

```bash
$ opencode mcp debug docs
MCP OAuth Debug: docs
URL: https://mcp.exemplo.test
Status: <status>
<detalhes de discovery, metadata e tokens sem exibir o segredo bruto>
```

---

## 14. Plugins: `opencode plugin`

### 14.1 Instalar no projeto

```bash
$ opencode plugin opencode-helicone-session
Installing opencode-helicone-session...
Updated <config-do-projeto>
```

Alias equivalente:

```bash
$ opencode plug opencode-helicone-session
<mesmo fluxo de opencode plugin>
```

### 14.2 Instalar globalmente

```bash
$ opencode plugin --global @minha-org/plugin
Installing @minha-org/plugin...
Updated /home/<usuario>/.config/opencode/opencode.jsonc
```

### 14.3 Substituir versao existente

```bash
$ opencode plugin --global --force opencode-helicone-session@2.0.0
Replacing existing plugin version...
Updated /home/<usuario>/.config/opencode/opencode.jsonc
```

> [!IMPORTANT]
> Reinicie o OpenCode depois de instalar ou atualizar plugins. Configuracao e plugins sao carregados no startup.

---

## 15. GitHub e pull requests

### 15.1 Instalar GitHub Agent

```bash
$ opencode github install
<assistente configura o workflow GitHub Actions no repositorio atual>
```

### 15.2 Executar GitHub Agent

```bash
$ opencode github run
<processa o evento GitHub fornecido pelo ambiente da Action>
```

Com evento mockado:

```bash
$ opencode github run --event pull_request
<executa o agente usando o evento mockado pull_request>
```

Com token:

```bash
$ opencode github run --token '<GITHUB_TOKEN>'
<autentica e executa o agente>
```

> [!CAUTION]
> Evite token literal. Em CI, use secret do provedor e variavel de ambiente.

### 15.3 Abrir pull request no OpenCode

```bash
$ opencode pr 123
Fetching pull request #123...
Checking out <branch-do-pr>...
<o TUI abre no branch do PR>
```

Esse comando altera o checkout do repositorio. Execute apenas em worktree limpo ou apropriado.

---

## 16. Banco de dados: `opencode db`

### 16.1 Descobrir o caminho

**Saida capturada:**

```bash
$ opencode db path
/home/albano/.local/share/opencode/opencode.db
```

### 16.2 Executar consulta em JSON

**Saida capturada em 2026-08-31:**

```bash
$ opencode db "SELECT count(*) AS total_sessions FROM session;" --format json
[
  {
    "total_sessions": 38
  }
]
```

O total muda com o uso.

### 16.3 Executar consulta em TSV

```bash
$ opencode db "SELECT id, title FROM session LIMIT 2;" --format tsv
id	title
ses_<id-1>	<titulo-1>
ses_<id-2>	<titulo-2>
```

### 16.4 Abrir shell SQLite interativo

```bash
$ opencode db
SQLite version <versao>
Enter ".help" for usage hints.
sqlite> SELECT count(*) FROM session;
<total>
sqlite> .quit
```

> [!WARNING]
> Consultas `UPDATE`, `DELETE`, `DROP` e similares alteram dados. Para exploracao, use apenas `SELECT`.

---

## 17. Depuracao: `opencode debug`

Esta secao reflete os subcomandos locais de `1.18.25`, inclusive os ausentes ou resumidos na pagina publica.

### 17.1 Catalogo local

```bash
$ opencode debug --help
Commands:
  opencode debug config        show resolved configuration
  opencode debug lsp           LSP debugging utilities
  opencode debug rg            ripgrep debugging utilities
  opencode debug file          file system debugging utilities
  opencode debug scrap         list all known projects
  opencode debug skill         list all available skills
  opencode debug snapshot      snapshot debugging utilities
  opencode debug startup       print startup timing
  opencode debug agent <name>  show agent configuration details
  opencode debug v2            debug v2 catalog and built-in plugins
  opencode debug info          show debug information
  opencode debug paths         show global paths
  opencode debug wait          wait indefinitely
```

### 17.2 Configuracao resolvida

```bash
$ opencode debug config
{
  "$schema": "https://opencode.ai/config.json",
  "model": "<provider/model>",
  "default_agent": "<agente>",
  "permission": { ... },
  "plugin": [ ... ]
}
```

> [!CAUTION]
> Revise antes de compartilhar: a configuracao resolvida pode conter caminhos locais, headers ou opcoes sensiveis.

### 17.3 Informacoes de ambiente

**Saida capturada:**

```bash
$ opencode debug info
opencode version: 1.18.25
os: Linux 6.18.47-xanmod1-1-rt x64
terminal: tmux 3.7c / tmux-256color
plugins:
- file:///home/albano/.config/opencode/plugins/agent-observer.js
```

### 17.4 Caminhos globais

**Saida capturada:**

```bash
$ opencode debug paths
home       /home/albano
data       /home/albano/.local/share/opencode
bin        /home/albano/.cache/opencode/bin
log        /home/albano/.local/share/opencode/log
repos      /home/albano/.local/share/opencode/repos
cache      /home/albano/.cache/opencode
config     /home/albano/.config/opencode
state      /home/albano/.local/state/opencode
tmp        /tmp/opencode
```

### 17.5 Tempo de startup

**Saida capturada; valor em milissegundos e variavel:**

```bash
$ opencode debug startup
419.492661
```

### 17.6 Agente resolvido e execucao de ferramenta

```bash
$ opencode debug agent plan-refine
{
  "name": "plan-refine",
  "mode": "primary",
  "description": "<descricao>",
  "permission": [ ... ]
}
```

Executar uma ferramenta do agente com parametros:

```bash
$ opencode debug agent plan-refine \
    --tool read \
    --params '{"filePath":"/home/albano/.config/opencode/package.json"}'
<resultado da ferramenta ou erro de permissao/parametros>
```

### 17.7 LSP: diagnosticos

```bash
$ opencode debug lsp diagnostics plugins/agent-observer.js
{}
```

`{}` foi a saida capturada com LSP desabilitado/sem diagnosticos aplicaveis.

### 17.8 LSP: simbolos do workspace

```bash
$ opencode debug lsp symbols AgentObserver
[]
```

### 17.9 LSP: simbolos de documento

```bash
$ opencode debug lsp document-symbols \
    file:///home/albano/.config/opencode/plugins/agent-observer.js
[]
```

### 17.10 Ripgrep: listar arquivos

```bash
$ opencode debug rg files --query MAN --limit 5
traces/metrics/models.json
traces/metrics/agents.json
traces/2026-08-31/<session>.trace.md
traces/2026-08-31/<session>.trace.json
traces/2026-08-31/<session>.jsonl
```

Filtrar por glob:

```bash
$ opencode debug rg files --glob "docs/**/*.md" --limit 5
docs/spec/opencode-cli.md
docs/adr/<arquivo>.md
docs/plan/<arquivo>.md
...
```

### 17.11 Ripgrep: buscar conteudo

**Saida capturada:**

```bash
$ opencode debug rg search "default_agent" --glob "*.jsonc" --limit 5
[
  {
    "entry": { "path": "opencode.jsonc", "type": "file" },
    "line": 6,
    "offset": 205,
    "text": "  \"default_agent\": \"plan-refine\",\n",
    "submatches": [
      { "text": "default_agent", "start": 3, "end": 16 }
    ]
  }
]
```

`--glob` e repetivel para multiplos padroes:

```bash
$ opencode debug rg search "permission" \
    --glob "agents/*.md" \
    --glob "*.jsonc" \
    --limit 20
<array JSON com ate 20 resultados>
```

### 17.12 Arquivo: ler como JSON

**Saida capturada:**

```bash
$ opencode debug file read package.json
{
  "content": "ewogICJ0eXBlIjogIm1vZHVsZSIsCiAgLi4uCg==",
  "encoding": "base64",
  "mime": "application/json"
}
```

O conteudo pode vir em Base64; para decodificar:

```bash
$ opencode debug file read package.json | jq -r .content | base64 -d
{
  "type": "module",
  "dependencies": {
    "@opencode-ai/plugin": "1.18.13"
  }
}
```

### 17.13 Arquivo: listar diretorio

**Saida capturada:**

```bash
$ opencode debug file list docs
[
  { "path": "docs/adr/", "type": "directory" },
  { "path": "docs/plan/", "type": "directory" },
  { "path": "docs/progress/", "type": "directory" },
  { "path": "docs/spec/", "type": "directory" }
]
```

### 17.14 Arquivo: pesquisar por nome

```bash
$ opencode debug file search "opencode-cli"
docs/spec/opencode-cli.md
...
```

### 17.15 Projetos conhecidos

```bash
$ opencode debug scrap
[
  {
    "id": "<hash-do-projeto>",
    "worktree": "/caminho/do/projeto",
    ...
  }
]
```

### 17.16 Skills disponiveis

```bash
$ opencode debug skill
[
  {
    "name": "<skill>",
    "description": "<descricao>",
    "location": "/caminho/SKILL.md"
  }
]
```

### 17.17 Snapshots: registrar estado

```bash
$ opencode debug snapshot track
<hash-do-snapshot>
```

### 17.18 Snapshots: patch e diff

```bash
$ opencode debug snapshot patch <hash-do-snapshot>
<patch associado ao hash>

$ opencode debug snapshot diff <hash-do-snapshot>
<diff entre o snapshot informado e o estado atual>
```

### 17.19 Catalogo v2

```bash
$ opencode debug v2
<catalogo v2 e plugins embutidos desta instalacao>
```

### 17.20 Espera indefinida

```bash
$ opencode debug wait
<nenhuma saida; processo fica bloqueado ate Ctrl+C>
^C
```

---

## 18. Atualizacao e desinstalacao

### 18.1 Atualizar para a versao mais recente

```bash
$ opencode upgrade
Current version: 1.18.25
Checking for updates...
<instala a versao mais recente ou informa que ja esta atualizado>
```

### 18.2 Atualizar para versao especifica

```bash
$ opencode upgrade v1.18.25
Upgrading opencode to v1.18.25...
<resultado do gerenciador selecionado>
```

### 18.3 Escolher metodo de instalacao

Metodos aceitos localmente: `curl`, `npm`, `pnpm`, `bun`, `brew`, `choco`, `scoop`.

```bash
$ opencode upgrade --method npm
<atualizacao usando npm>

$ opencode upgrade --method bun
<atualizacao usando bun>

$ opencode upgrade --method brew
<atualizacao usando Homebrew>
```

### 18.4 Auditar desinstalacao sem remover

```bash
$ opencode uninstall --dry-run
The following files would be removed:
  <binario>
  <cache>
  <config, se --keep-config nao for usado>
  <dados, se --keep-data nao for usado>
No files were removed.
```

### 18.5 Preservar configuracao e/ou dados

```bash
$ opencode uninstall --dry-run --keep-config
<lista tudo que seria removido, exceto configuracao>

$ opencode uninstall --dry-run --keep-data
<lista tudo que seria removido, exceto sessoes e snapshots>

$ opencode uninstall --dry-run --keep-config --keep-data
<lista apenas binario/cache removiveis>
```

### 18.6 Desinstalacao efetiva

```bash
$ opencode uninstall --keep-config --keep-data
Are you sure you want to uninstall OpenCode? (y/N)
y
<remove o programa, preservando configuracao e dados>
```

Pular confirmacao:

```bash
$ opencode uninstall --force
<remove imediatamente os componentes selecionados>
```

> [!DANGER]
> Use `--dry-run` primeiro. `--force` elimina a ultima confirmacao humana.

---

## 19. Plano de utilizacao

### Fase 1: inventario inicial

```bash
$ opencode --version
1.18.25

$ opencode debug info
opencode version: 1.18.25
os: <sistema>
terminal: <terminal>
plugins:
- <plugins carregados>

$ opencode debug paths
home       <home>
data       <dados>
config     <configuracao>
...
```

### Fase 2: validar providers, modelos e agentes

```bash
$ opencode auth list
<providers configurados, sem revelar chaves>

$ opencode models --refresh
<lista provider/model atualizada>

$ opencode agent list
<agentes e permissoes resolvidas>
```

### Fase 3: trabalho diario no TUI

```bash
$ opencode /caminho/do/projeto
<TUI>

$ opencode --continue
<TUI na ultima sessao>

$ opencode --mini --replay-limit 30
<interface minima com replay limitado>
```

### Fase 4: automacao reproduzivel

```bash
$ opencode run \
    --agent build-guarded \
    --format json \
    --title "CI: revisar alteracoes" \
    "Revise as alteracoes e reporte falhas"
<eventos JSON, um por linha>
```

### Fase 5: servidor persistente para evitar cold starts

Terminal 1:

```bash
$ OPENCODE_SERVER_PASSWORD='<SENHA>' opencode serve --port 4096
opencode server listening on http://127.0.0.1:4096
```

Terminal 2:

```bash
$ OPENCODE_SERVER_PASSWORD='<SENHA>' \
  opencode run --attach http://127.0.0.1:4096 "Resuma o projeto"
<resposta sem reiniciar o backend/MCP>
```

### Fase 6: auditoria semanal

```bash
$ opencode stats --days 7 --tools 10 --models 10
<custos, tokens, modelos e ferramentas dos ultimos 7 dias>

$ opencode session list -n 20 --format json
[ <20 sessoes mais recentes> ]

$ opencode db "SELECT count(*) AS total_sessions FROM session;" --format json
[{"total_sessions":<total>}]
```

### Fase 7: backup antes de manutencao

```bash
$ opencode export ses_abc123 --sanitize > backup-sessao.json
<sem saida; backup criado>

$ opencode uninstall --dry-run --keep-config --keep-data
<auditoria sem remocao>

$ opencode upgrade
<resultado da atualizacao>
```

---

## 20. Variaveis de ambiente

### 20.1 Configuracao e runtime

| Variavel | Exemplo no shell | Efeito |
|---|---|---|
| `OPENCODE_CONFIG` | `OPENCODE_CONFIG=/tmp/teste.json opencode` | carrega arquivo adicional |
| `OPENCODE_TUI_CONFIG` | `OPENCODE_TUI_CONFIG=/tmp/tui.json opencode` | escolhe config da TUI |
| `OPENCODE_CONFIG_DIR` | `OPENCODE_CONFIG_DIR=/tmp/oc opencode` | muda diretorio de config |
| `OPENCODE_CONFIG_CONTENT` | `OPENCODE_CONFIG_CONTENT='{"share":"disabled"}' opencode` | injeta JSON inline |
| `OPENCODE_PERMISSION` | `OPENCODE_PERMISSION='{"bash":"deny"}' opencode` | injeta permissoes |
| `OPENCODE_AUTO_SHARE` | `OPENCODE_AUTO_SHARE=false opencode` | controla share automatico |
| `OPENCODE_DISABLE_AUTOUPDATE` | `OPENCODE_DISABLE_AUTOUPDATE=true opencode` | desliga check de update |
| `OPENCODE_DISABLE_PRUNE` | `OPENCODE_DISABLE_PRUNE=true opencode` | desliga poda de dados |
| `OPENCODE_DISABLE_TERMINAL_TITLE` | `...=true opencode` | preserva titulo do terminal |
| `OPENCODE_DISABLE_DEFAULT_PLUGINS` | `...=true opencode` | desliga plugins padrao |
| `OPENCODE_DISABLE_LSP_DOWNLOAD` | `...=true opencode` | impede downloads LSP |
| `OPENCODE_DISABLE_AUTOCOMPACT` | `...=true opencode` | desliga compactacao automatica |
| `OPENCODE_DISABLE_MODELS_FETCH` | `...=true opencode` | desliga fetch remoto de modelos |
| `OPENCODE_DISABLE_MOUSE` | `...=true opencode` | desliga captura de mouse |
| `OPENCODE_ENABLE_EXPERIMENTAL_MODELS` | `...=true opencode models` | inclui modelos experimentais |
| `OPENCODE_CLIENT` | `OPENCODE_CLIENT=meu-cli opencode` | identifica o cliente |
| `OPENCODE_SERVER_USERNAME` | `...=albano opencode serve` | usuario de auth basica |
| `OPENCODE_SERVER_PASSWORD` | `...='<SENHA>' opencode serve` | ativa auth basica |
| `OPENCODE_MODELS_URL` | `...=https://<host>/models.json opencode` | fonte custom de modelos |

### 20.2 Compatibilidade Claude Code

```bash
$ OPENCODE_DISABLE_CLAUDE_CODE=true opencode
<abre sem importar prompt nem skills de .claude>

$ OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=true opencode
<ignora apenas ~/.claude/CLAUDE.md>

$ OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=true opencode
<ignora apenas .claude/skills>
```

### 20.3 Busca web

```bash
$ OPENCODE_ENABLE_EXA=true opencode
<habilita ferramentas de busca Exa>

$ OPENCODE_ENABLE_PARALLEL=true opencode
<habilita ferramentas de busca Parallel>
```

### 20.4 Experimentais

Estas variaveis podem mudar ou desaparecer:

```bash
$ OPENCODE_EXPERIMENTAL=true opencode
<ativa o umbrella experimental>

$ OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true opencode
<habilita tarefas de subagentes em background>

$ OPENCODE_EXPERIMENTAL_EVENT_SYSTEM=true opencode
<habilita sistema experimental de eventos>

$ OPENCODE_EXPERIMENTAL_SCOUT=true opencode
<habilita subagente Scout experimental>

$ OPENCODE_EXPERIMENTAL_PLAN_MODE=true opencode
<habilita plan mode experimental>

$ OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS=120000 opencode
<define timeout bash experimental para 120 s>

$ OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX=16000 opencode
<limita output experimental a 16000 tokens>
```

Outras flags documentadas: `OPENCODE_EXPERIMENTAL_ICON_DISCOVERY`, `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT`, `OPENCODE_EXPERIMENTAL_FILEWATCHER`, `OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER`, `OPENCODE_EXPERIMENTAL_OXFMT`, `OPENCODE_EXPERIMENTAL_LSP_TOOL`, `OPENCODE_EXPERIMENTAL_LSP_TY`, `OPENCODE_EXPERIMENTAL_EXA`, `OPENCODE_EXPERIMENTAL_NATIVE_LLM`, `OPENCODE_EXPERIMENTAL_PARALLEL`, `OPENCODE_EXPERIMENTAL_WORKSPACES`.

---

## 21. Apendice: comandos internos do TUI

Estes comandos nao sao executados no shell; digite-os dentro do prompt do TUI:

| Comando | Alias | Resultado |
|---|---|---|
| `/connect` | | conecta provider |
| `/compact` | `/summarize` | compacta sessao |
| `/details` | | alterna detalhes das ferramentas |
| `/editor` | | abre editor externo |
| `/exit` | `/quit`, `/q` | encerra o TUI |
| `/export` | | exporta conversa para Markdown |
| `/help` | | abre ajuda |
| `/init` | | cria/atualiza `AGENTS.md` |
| `/models` | | escolhe modelo |
| `/new` | `/clear` | cria nova sessao |
| `/redo` | | refaz o ultimo undo |
| `/sessions` | `/resume`, `/continue` | lista e troca sessoes |
| `/share` | | compartilha sessao |
| `/unshare` | | remove o compartilhamento da sessao |
| `/themes` | | escolhe tema |
| `/thinking` | | alterna exibicao do thinking |
| `/undo` | | desfaz mensagem e mudancas associadas |

Exemplo de ciclo:

```text
<dentro do TUI>
> /sessions
<abre o seletor de sessoes>

> /details
<passa a exibir/ocultar detalhes das ferramentas>

> /exit
<retorna ao shell>
```

---

## Fontes e criterio de atualizacao

- Documentacao oficial: https://opencode.ai/docs/cli/
- TUI oficial: https://opencode.ai/docs/tui/
- SDK oficial: https://opencode.ai/docs/sdk/
- Fonte definitiva da instalacao: `opencode --help` e `opencode <comando> --help`

Quando atualizar o OpenCode:

```bash
$ opencode --version
<nova-versao>

$ opencode --help
<compare comandos e flags com este manual>
```

Atualize o campo **Ambiente verificado** e registre novas flags/subopcoes antes de considerar o manual vigente.
