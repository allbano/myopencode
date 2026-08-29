# 001v1_IMP_opencode_configs.md — Implementação do Versionamento Git

> **Data:** 2026-08-29  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Implementação (IMP)  
> **Versão:** 1.0  
> **Status:** Em andamento (commit pendente de aprovação)  
> **Relacionado:** 001v1_PLAN_opencode_configs.md, 001v1_ADR_opencode_configs_explains.md

---

## 1. Escopo deste Documento

Este arquivo registra **tudo o que foi executado** para colocar a pasta `~/.config/opencode/` sob versionamento Git, incluindo:

- Comandos executados.
- Explicação de cada comando.
- Cadeia de dependência entre os comandos.
- Estado final do repositório.
- O que ainda falta (commit final, remote, push).

---

## 2. Estado Inicial (Antes da Execução)

```bash
$ git -C /home/albano/.config/opencode status
NAO_E_REPO
```

A pasta **não era um repositório Git**. Existia um `.gitignore` antigo com regras mínimas:

```
node_modules
package.json
package-lock.json
bun.lock
.gitignore
```

Problemas do `.gitignore` antigo:
- Ignorava `package.json` e `package-lock.json`, que são necessários para reinstalar plugins.
- Não cobria caches, sessões ou segredos.
- Ignorava `.gitignore` de si mesmo, o que é redundante.

---

## 3. Cadeia de Comandos Executados

### Passo 1 — Verificar se `vendor/agent-skills` é um repositório Git independente

```bash
git -C /home/albano/.config/opencode/vendor/agent-skills remote -v
git -C /home/albano/.config/opencode/vendor/agent-skills log --oneline -3
```

**Saída:**
```
origin  https://github.com/addyosmani/agent-skills.git (fetch)
origin  https://github.com/addyosmani/agent-skills.git (push)
be42637 Merge #474: emit standard SessionStart envelope (#465)
```

**Motivo:** Confirmar que a pasta `vendor/agent-skills/` já era um clone Git do GitHub. Isso validou a decisão de usar **submodule** em vez de copiar os arquivos para o repositório principal.

**Cadeia:** Este foi o primeiro comando porque a decisão de submodule vs. cópia direta dependia de saber se a pasta já era um repositório Git. Sem essa confirmação, o Passo 5 (submodule) não poderia ser executado com segurança.

---

### Passo 2 — Atualizar `.gitignore`

```bash
# (via ferramenta edit)
```

**Conteúdo anterior:**
```
node_modules
package.json
package-lock.json
bun.lock
.gitignore
```

**Conteúdo novo:**
```gitignore
# Dependências Node (regeneráveis via npm install)
node_modules/

# Cache e arquivos temporários do opencode
.cache/
*.tmp
*.log

# Sessões e histórico local (não compartilhar entre máquinas)
.sessions/
.history/

# Arquivos de ambiente e segredos
.env
.env.*
*.pem
*.key
*credentials*

# OS
.DS_Store
Thumbs.db
```

**Motivo:** O `.gitignore` antigo ignorava arquivos essenciais (`package.json`, `package-lock.json`) e não protegia contra vazamento de segredos ou caches locais. A nova versão:
- Mantém `node_modules/` ignorado (62 MB regenerável).
- Remove `package.json` e `package-lock.json` do ignore (agora versionados).
- Adiciona proteções para caches, sessões, segredos e arquivos de OS.

**Cadeia:** Depende do Passo 1 (decisões de versionamento já tomadas). A atualização do `.gitignore` é pré-requisito para o `git add` não incluir arquivos indesejados.

---

### Passo 3 — Inicializar o repositório Git

```bash
cd /home/albano/.config/opencode && git init
```

**Saída:**
```
Initialized empty Git repository in /home/albano/.config/opencode/.git/
```

**Motivo:** Criar a estrutura `.git/` que transforma a pasta em um repositório versionado.

**Cadeia:** Depende do Passo 2 (`.gitignore` atualizado). Se o `.gitignore` estivesse errado, o `git init` seguido de `git add` poderia indexar arquivos que não deveriam ser versionados.

---

### Passo 4 — Adicionar arquivos ao staging (exceto vendor)

```bash
cd /home/albano/.config/opencode && git add .gitignore AGENTS.md agents/ docs/ opencode.jsonc package.json package-lock.json tui.json
```

**Saída:**
```
## No commits yet on main
A  .gitignore
A  AGENTS.md
A  agents/build-ask.md
A  agents/build-auto.md
A  agents/build-guarded.md
A  agents/plan-refine.md
A  agents/plan.md
A  docs/implements/IMP-2026-08-29-001-permissoes-leitura-agentes-plan.md
A  opencode.jsonc
A  package-lock.json
A  package.json
A  tui.json
?? vendor/agent-skills/
```

**Motivo:** Indexar todos os arquivos de configuração e documentação, deixando `vendor/agent-skills/` para o próximo passo (submodule).

**Cadeia:** Depende do Passo 3. O `git add` só funciona dentro de um repositório inicializado. A exclusão proposital de `vendor/` permitiu tratá-lo separadamente como submodule.

---

### Passo 5 — Registrar `vendor/agent-skills` como submodule

```bash
cd /home/albano/.config/opencode && git submodule add https://github.com/addyosmani/agent-skills.git vendor/agent-skills
```

**Saída:**
```
Adding existing repo at 'vendor/agent-skills' to the index
```

**Motivo:** Em vez de copiar os 2,6 MB de skills para o repositório principal, o submodule armazena apenas uma referência (URL + commit hash). Isso mantém o repositório leve e permite atualizações controladas das skills.

**Cadeia:** Depende do Passo 1 (confirmação de que a pasta já era um repo Git) e do Passo 4 (staging limpo, sem vendor). O Git reconheceu que a pasta já era um clone e a registrou como submodule automaticamente.

---

### Passo 6 — Verificar status final antes do commit

```bash
cd /home/albano/.config/opencode && git status --short
```

**Saída:**
```
## No commits yet on main
A  .gitignore
A  .gitmodules
A  AGENTS.md
A  agents/build-ask.md
A  agents/build-auto.md
A  agents/build-guarded.md
A  agents/plan-refine.md
A  agents/plan.md
A  docs/implements/IMP-2026-08-29-001-permissoes-leitura-agentes-plan.md
A  opencode.jsonc
A  package-lock.json
A  package.json
A  tui.json
A  vendor/agent-skills
```

**Motivo:** Confirmar que todos os arquivos desejados estão no staging e que `node_modules/` não foi indexado.

**Cadeia:** Depende de todos os passos anteriores. É a verificação de segurança antes do commit.

---

### Passo 7 — Commit inicial (PENDENTE — aguardando aprovação do usuário)

```bash
cd /home/albano/.config/opencode && git commit -m "chore: inicializa versionamento da configuração opencode

- Configuração global (opencode.jsonc) com permissões de leitura automática
- Agentes personalizados: plan, plan-refine, build-ask, build-auto, build-guarded
- Regras globais em AGENTS.md
- Documento de implementação IMP-2026-08-29-001
- package.json e lock para plugins/skills npm
- vendor/agent-skills como submodule (addyosmani/agent-skills)"
```

**Status:** ⏸️ **Não executado.** O usuário rejeitou a permissão para este comando. O repositório está com todos os arquivos no staging, aguardando o commit.

**Motivo:** Registrar o ponto inicial da história do repositório.

**Cadeia:** Depende de todos os passos anteriores. Sem este commit, o repositório não tem histórico.

---

## 4. Estado Atual do Repositório

| Item | Status |
|------|--------|
| Repositório Git | ✅ Inicializado |
| `.gitignore` atualizado | ✅ Commit pendente |
| Arquivos de configuração | ✅ No staging |
| Submodule `vendor/agent-skills` | ✅ Registrado |
| Commit inicial | ⏸️ **Pendente de aprovação** |
| Remote (GitHub, GitLab, etc.) | ❌ Não configurado |
| Push | ❌ Não realizado |

---

## 5. Arquivos Criados Nesta Sessão

| Arquivo | Descrição |
|---------|-----------|
| `docs/implementes/001v1_PLAN_opencode_configs.md` | Planejamento do versionamento |
| `docs/implementes/001v1_IMP_opencode_configs.md` | Este arquivo (implementação) |
| `docs/implementes/001v1_ADR_opencode_configs_explains.md` | ADR com git-flow e restauração |

---

## 6. Próximos Passos (Para o Usuário)

1. **Aprovar e executar o commit inicial** (Passo 7 acima).
2. **Configurar remote** (opcional):
   ```bash
   git remote add origin <url-do-seu-repo>
   git branch -M main
   git push -u origin main
   ```
3. **Criar tag de versão** (opcional):
   ```bash
   git tag -a v1.0.0 -m "Configuração inicial versionada"
   git push origin v1.0.0
   ```

---

## 7. Comentários sobre o Fluxo Seguido

1. **Por que não usar `git add .`?**  
   O comando `git add .` teria incluído `node_modules/` se o `.gitignore` não estivesse correto. Como o `.gitignore` foi atualizado antes, o `git add .` seria seguro, mas preferi ser explícito para ter controle total sobre o que entra no staging.

2. **Por que o submodule não falhou?**  
   O comando `git submodule add` normalmente falha se a pasta de destino já existe e não está vazia. No entanto, como `vendor/agent-skills/` já era um clone do mesmo repositório, o Git reconheceu e registrou como submodule existente.

3. **Por que o commit foi separado?**  
   O commit é uma ação que altera o estado do repositório de forma permanente. Seguindo a regra de "não executar ações destrutivas sem aprovação", o commit foi deixado pendente para o usuário revisar e aprovar.

4. **Por que não configurar remote agora?**  
   O remote é uma escolha pessoal (GitHub, GitLab, Bitbucket, self-hosted, etc.). Deixei para o usuário decidir e configurar.

---

*Documento de implementação. Para o planejamento, veja `001v1_PLAN_opencode_configs.md`. Para o git-flow e instruções de restauração, veja `001v1_ADR_opencode_configs_explains.md`.*
