---
title: "Especificação Técnica e Arquitetura dos Agentes OpenCode"
slug: "opencode-agents"
version: 1.0.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Especificação Técnica: Agentes OpenCode e Modelo de Permissões

> **Tipo:** Especificação Canônica (SPEC)  
> **Status:** Ativo  
> **Relacionado:** [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md), [`docs/spec/agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/spec/agent-runtime-observability.md)

---

## 1. Visão Geral

O OpenCode opera por meio de uma arquitetura baseada em agentes e subagentes especializados. O ecossistema combina **agentes nativos embutidos** no binário da CLI com **agentes locais customizados** declarados em `~/.config/opencode/agents/*.md`.

Esta especificação define os agentes configurados, seus escopos operacionais, ferramentas disponíveis e a política de permissões de inspeção e leitura.

---

## 2. Catálogo de Agentes

### 2.1 Agentes Nativos (Binário)

| Agente | Tipo | Descrição |
|---|---|---|
| `build` | Primário | Agente padrão de escrita e execução de código. |
| `plan` | Primário | Agente de arquitetura e planejamento. No repositório local, é customizado por [`agents/plan.md`](file:///home/albano/.config/opencode/agents/plan.md). |
| `general` | Primário | Agente genérico para tarefas gerais e navegação. |
| `explore` | Subagente | Agente leve para exploração e leitura rápida de código. |
| `compaction` | Interno | Responsável pela compactação de histórico quando o limite de contexto se aproxima. |
| `summary` | Interno | Responsável pela sumarização de conversas e transições de estado. |
| `title` | Interno | Gera automaticamente o título da sessão a partir da primeira mensagem. |

### 2.2 Agentes Locais Customizados (`agents/*.md`)

| Arquivo | Agente | Modo de Permissão | Escopo |
|---|---|---|---|
| [`agents/plan.md`](file:///home/albano/.config/opencode/agents/plan.md) | `plan` | Leitura ampla (`bash: allow` para inspeção, `edit: deny`) | Cria planos, especificações e ADRs sem alterar código de produção. |
| [`agents/plan-refine.md`](file:///home/albano/.config/opencode/agents/plan-refine.md) | `plan-refine` | Leitura ampla com refino | Agente padrão (`default_agent` no `opencode.jsonc`). Conduz sessões interativas de arquitetura. |
| [`agents/build-ask.md`](file:///home/albano/.config/opencode/agents/build-ask.md) | `build-ask` | `edit: ask`, `bash: ask` | Desenvolve código solicitando confirmação manual para cada ação de escrita. |
| [`agents/build-guarded.md`](file:///home/albano/.config/opencode/agents/build-guarded.md) | `build-guarded` | Guarded | Executa código sob checagens rígidas e validação contínua. |
| [`agents/build-auto.md`](file:///home/albano/.config/opencode/agents/build-auto.md) | `build-auto` | Automatizado | Executa passos pré-aprovados para fluxos de CI ou tarefas rotineiras. |

---

## 3. Modelo de Permissões de Leitura e Inspeção

### 3.1 Otimização de Leitura nos Agentes Plan
Anteriormente, agentes de planejamento operavam com `bash: deny` e `external_directory: ask`, forçando interrupções constantes para comandos inofensivos de leitura (ex: `ls`, `git status`, `python --version`).

A configuração ativa garante **leitura e inspeção automáticas**, preservando a vedação a mutações:

```jsonc
"bash": {
  "*": "ask",
  "ls *": "allow",
  "cat *": "allow",
  "head *": "allow",
  "tail *": "allow",
  "find *": "allow",
  "tree *": "allow",
  "pwd": "allow",
  "git status*": "allow",
  "git diff*": "allow",
  "git log*": "allow",
  "git show*": "allow",
  "git branch*": "allow",
  "git tag*": "allow",
  "git remote -v": "allow",
  "npm ls*": "allow",
  "pnpm ls*": "allow",
  "yarn list*": "allow",
  "pip list*": "allow",
  "pip show*": "allow",
  "python --version": "allow",
  "node --version": "allow",
  "go version": "allow",
  "cargo --version": "allow",
  "java -version": "allow",
  "mvn -version": "allow",
  "gradle -version": "allow",
  "docker --version": "allow",
  "docker ps*": "allow",
  "docker images*": "allow",
  "systemctl status*": "allow",
  "env": "deny",
  "printenv": "deny"
}
```

### 3.2 Proteção Contra Exposição de Segredos
Independentemente do agente ativo:
- `env` e `printenv` são estritamente **bloqueados** (`deny`).
- Padrões de arquivos sensíveis são bloqueados para leitura automática (`*.env`, `*.pem`, `*.key`, `*credentials*`, `~/.ssh/**`, `~/.aws/**`, `~/.gnupg/**`).

---

## 4. Subagentes e Orquestração

1. **Profundidade:** `subagent_depth: 1` no [`opencode.jsonc`](file:///home/albano/.config/opencode/opencode.jsonc#L7). Subagentes especialistas **não devem invocar novos subagentes** recursivamente.
2. **Ferramenta `task`:** Invocada pelo agente primário passando `subagent_type`, `description` e `prompt`.
3. **Observabilidade:** Todas as invocações de subagentes são interceptadas pelo plugin [`plugins/agent-observer.js`](file:///home/albano/.config/opencode/plugins/agent-observer.js), medindo latência, tokens consumidos e disparando notificação desktop Linux quando concluído.

---

## 5. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-09-04 | INITIAL | Consolidação da especificação canônica dos 11 agentes e permissões. |

---

## 6. Referências

- [`docs/spec/opencode-cli.md`](file:///home/albano/.config/opencode/docs/spec/opencode-cli.md)
- [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md)
- [`docs/spec/agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/spec/agent-runtime-observability.md)
