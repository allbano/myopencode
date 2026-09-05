---
title: "Git-Flow e Restauração da Configuração OpenCode"
slug: "opencode-configs"
version: 1.0.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# ADR 0001: Git-Flow e Restauração da Configuração OpenCode

> **Tipo:** Architecture Decision Record (ADR)  
> **Status:** Aceito  
> **Relacionado:** [`docs/plan/opencode-configs.md`](file:///home/albano/.config/opencode/docs/plan/opencode-configs.md), [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md)

---

## 1. Contexto

Este ADR documenta as decisões arquiteturais sobre como o repositório Git de `~/.config/opencode/` deve ser gerenciado, clonado e restaurado em uma máquina nova após a instalação do opencode.

---

## 2. Decisão: Git-Flow do Repositório

### 2.1 Modelo de branches

Adotamos **Trunk-Based Development** simplificado:

```text
main (sempre estável e restaurável)
  │
  ├── feature/<descricao>     ← mudanças de configuração, novos agentes
  ├── fix/<descricao>         ← correções pontuais
  └── chore/<descricao>       ← atualizações de dependências, skills
```

**Regras:**
- `main` deve sempre estar em estado funcional (ou seja, o opencode deve iniciar sem erros com a configuração de `main`).
- Branches de feature vivem no máximo 1-3 dias.
- Merge para `main` assim que a mudança for testada localmente.
- Tags para marcar versões estáveis: `v1.0.0`, `v1.1.0`, etc.

### 2.2 Convenção de commits

```text
<tipo>: <descrição curta>
```

| Tipo | Uso |
|------|-----|
| `feat` | Novo agente, nova skill, nova funcionalidade de configuração |
| `fix` | Correção de permissão, correção de bug em configuração |
| `chore` | Atualização de submodule, atualização de dependências npm |
| `docs` | Criação ou atualização de documentos em `docs/` |
| `refactor` | Reorganização de estrutura sem mudança de comportamento |

### 2.3 O que NUNCA fazer

- ❌ `git push --force` em `main`.
- ❌ Commitar `node_modules/`, `.env`, `*.pem`, `*.key`.
- ❌ Commitar arquivos de sessão ou cache do opencode.
- ❌ Atualizar o submodule sem testar localmente primeiro.

---

## 3. Decisão: Estrutura de Submodules

### 3.1 Por que submodule e não cópia direta?

| Critério | Submodule | Cópia direta |
|----------|-----------|--------------|
| Tamanho do repo principal | ~50 KB | ~2,6 MB |
| Atualização das skills | `git pull` dentro do submodule | Manual, propenso a erro |
| Rastreabilidade de versão | Commit hash exato | Perdida após cópia |
| Complexidade de restauração | Requer `git submodule update --init` | Nenhuma |
| Dependência de internet na restauração | Sim | Não |

**Decisão:** Submodule, porque a rastreabilidade e o tamanho do repositório são mais importantes que a simplicidade de restauração. A complexidade adicional é mitigada por este documento.

### 3.2 Como o submodule é registrado

O arquivo `.gitmodules` (gerado automaticamente) contém:

```ini
[submodule "vendor/agent-skills"]
    path = vendor/agent-skills
    url = https://github.com/addyosmani/agent-skills.git
```

O repositório principal armazena apenas o commit hash do submodule, não os arquivos.

---

## 4. Decisão: Processo de Restauração em Máquina Nova

### 4.1 Pré-requisitos

- Git instalado.
- opencode instalado (`npm install -g opencode-ai` ou equivalente).
- Acesso ao repositório remoto (se houver) ou backup local do repositório.

### 4.2 Passo a passo completo

#### Passo 1 — Instalar o opencode

```bash
npm install -g opencode-ai
# ou
curl -fsSL https://opencode.ai/install | bash
```

**O que acontece:** O opencode cria a pasta `~/.config/opencode/` com arquivos padrão.

#### Passo 2 — Fazer backup da configuração padrão (opcional, mas recomendado)

```bash
mv ~/.config/opencode ~/.config/opencode-default-backup
```

**Motivo:** Se algo der errado, você pode voltar à configuração padrão.

#### Passo 3 — Clonar o repositório de configuração

```bash
git clone <url-do-seu-repo> ~/.config/opencode
```

**Se o repositório estiver apenas local** (sem remote):
```bash
cp -r /caminho/do/backup/opencode ~/.config/opencode
cd ~/.config/opencode && git init && git add . && git commit -m "restore"
```

#### Passo 4 — Inicializar o submodule

```bash
cd ~/.config/opencode
git submodule update --init --recursive
```

**O que acontece:** O Git baixa o conteúdo de `vendor/agent-skills/` na versão exata registrada no repositório principal.

**Se falhar por falta de internet:**
```bash
# Copie manualmente de uma máquina que já tenha as skills
cp -r /caminho/do/backup/agent-skills ~/.config/opencode/vendor/
```

#### Passo 5 — Reinstalar dependências npm (se existirem)

```bash
cd ~/.config/opencode
npm install
```

**O que acontece:** O `npm install` lê o `package.json` e `package-lock.json` e recria a pasta `node_modules/` com as dependências exatas.

**Se não houver `package.json`:** Este passo é opcional. O opencode funciona sem plugins npm adicionais.

#### Passo 6 — Verificar integridade

```bash
# Verificar se o opencode inicia sem erros
opencode --version

# Verificar se os agentes estão carregados
opencode agents list

# Verificar se as skills estão disponíveis
opencode skills list
```

**Se algum comando falhar:**
1. Verifique se o submodule foi inicializado corretamente: `ls ~/.config/opencode/vendor/agent-skills/`
2. Verifique se o `node_modules/` existe: `ls ~/.config/opencode/node_modules/`
3. Verifique se há erros de sintaxe no `opencode.jsonc`: `opencode config validate`

#### Passo 7 — Configurar remote (se ainda não tiver)

```bash
cd ~/.config/opencode
git remote add origin <url-do-seu-repo>
git branch -M main
git push -u origin main
```

---

## 5. Decisão: Atualização das Skills de Terceiros

### 5.1 Fluxo de atualização

```bash
# 1. Entrar no submodule
cd ~/.config/opencode/vendor/agent-skills

# 2. Buscar atualizações
git fetch origin
git log HEAD..origin/main --oneline  # ver o que mudou

# 3. Atualizar
git pull origin main

# 4. Voltar ao repositório principal
cd ~/.config/opencode

# 5. Verificar o que mudou
git diff vendor/agent-skills

# 6. Commitar a nova versão do submodule
git add vendor/agent-skills
git commit -m "chore: atualiza agent-skills para <versão ou descrição>"
```

### 5.2 Quando atualizar

- Quando uma nova skill for lançada que você queira usar.
- Quando houver correção de bug em uma skill que você usa.
- **Não atualizar** automaticamente sem revisar as mudanças.

---

## 6. Decisão: Backup e Redundância

### 6.1 Estratégia de backup

| Camada | Método | Frequência |
|--------|--------|------------|
| Local | Git commits | A cada mudança |
| Remoto | Push para GitHub/GitLab/self-hosted | A cada commit ou diariamente |
| Físico | Backup da pasta `~/.config/opencode/` em HD externo/NAS | Semanalmente |

### 6.2 Recuperação de desastre

Se a pasta `~/.config/opencode/` for completamente perdida:

1. Restaurar do backup mais recente.
2. Se não houver backup, clonar do remote (se existir).
3. Se não houver remote, reconfigurar manualmente usando os documentos em [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md) como referência.

---

## 7. Alternativas Consideradas e Rejeitadas

| Alternativa | Por que foi rejeitada |
|-------------|----------------------|
| Versionar `node_modules/` | 62 MB de arquivos binários/regeneráveis; polui o histórico |
| Copiar `vendor/agent-skills/` diretamente | Perde rastreabilidade de versão; aumenta tamanho do repo em 52x |
| Não versionar `package.json` | Dificulta reinstalação reproduzível de plugins |
| Usar Git LFS para `vendor/` | Complexidade desnecessária para 2,6 MB de texto |
| Sincronização via Dropbox/Google Drive | Sem histórico, sem controle de versão, propenso a conflitos |

---

## 8. Consequências desta Decisão

### Positivas
- ✅ Configuração totalmente versionada e auditável.
- ✅ Restauração reproduzível em qualquer máquina.
- ✅ Repositório leve (~50 KB sem vendor).
- ✅ Atualizações de skills são explícitas e controladas.
- ✅ Documentação completa do processo.

### Negativas / Riscos
- ⚠️ Restauração requer internet para baixar o submodule (mitigado: cópia manual).
- ⚠️ Usuário precisa lembrar de commitar mudanças (mitigado: hooks, lembretes).
- ⚠️ Submodule adiciona complexidade para quem não conhece Git (mitigado: este documento).

---

## 9. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-08-29 | INITIAL | Versão inicial aceita do ADR de configuração e Git-Flow. |

---

## 10. Referências

- [Git Submodules — Atlassian](https://www.atlassian.com/git/tutorials/git-submodule)
- [Trunk-Based Development](https://trunkbaseddevelopment.com/)
- [OpenCode — Configuração](https://opencode.ai/docs/config/)
- Documentos relacionados: [`docs/plan/opencode-configs.md`](file:///home/albano/.config/opencode/docs/plan/opencode-configs.md), [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md)
