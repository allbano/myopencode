---
title: "Especificação de Configuração e Versionamento do OpenCode"
slug: "opencode-configs"
version: 1.0.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Especificação Técnica: Configuração Base e Repositório OpenCode

> **Tipo:** Especificação Canônica (SPEC)  
> **Status:** Ativo  
> **Relacionado:** [`docs/adr/0001-opencode-configs.md`](file:///home/albano/.config/opencode/docs/adr/0001-opencode-configs.md), [`docs/plan/opencode-configs.md`](file:///home/albano/.config/opencode/docs/plan/opencode-configs.md)

---

## 1. Visão Geral

Esta especificação define os padrões de configuração, regras de versionamento Git, gestão de submodules e arquivos de ambiente do diretório `~/.config/opencode/`.

---

## 2. Arquivos Canônicos de Configuração

### 2.1 `opencode.jsonc` (Configuração Central)
Define o runtime do assistente:
- **`default_agent`**: `"plan-refine"` (modo planejamento como entrada padrão).
- **`subagent_depth`**: `1` (evita recursão não supervisionada).
- **`share`**: `"disabled"` (impede compartilhamento involuntário de sessões).
- **`autoupdate`**: `"notify"` (notifica sobre novas versões sem atualizar silenciosamente).
- **`permission`**: política granular de `read`, `edit`, `bash` e `external_directory`.

### 2.2 `tui.json` (Interface do Terminal)
Define atalhos, navegação e sistema de atenção:
- **`attention.enabled`**: `true`.
- **`attention.notifications`**: `false` (desativa sequências OSC para evitar ruído no terminal).
- **`attention.sound`**: `true` (mantém feedback sonoro de eventos).
- **`attention.volume`**: `0.4`.

### 2.3 `AGENTS.md` (Instruções Globais)
Contém as regras globais de engenharia, proteção de segredos e conduta de subagentes.

---

## 3. Gestão de Dependências e Submodule

### 3.1 Submodule `vendor/agent-skills`
- Caminho: `vendor/agent-skills`
- Repositório remoto: `https://github.com/addyosmani/agent-skills.git`
- O repositório principal armazena apenas o commit hash, mantendo a árvore leve.
- Registrado no `opencode.jsonc` sob `"skills.paths"` e `"references.addy-agent-skills"`.

### 3.2 Dependências NPM
- `package.json` possui `"type": "module"` para garantir carregamento nativo de plugins ESM.
- `package-lock.json` é versionado para garantir reinstalação determinística.
- `node_modules/` é estritamente ignorado no `.gitignore`.

---

## 4. Política de Exclusão (`.gitignore`)

O repositório ignora:
- Dependências: `node_modules/`, `bun.lock`
- Dados de runtime locais: `traces/`, `chats/`, `sessions/`
- Segredos e credenciais: `.env*`, `*.pem`, `*.key`, `*credentials*`
- Caches de sistema operacional e ferramentas.

---

## 5. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-08-29 | INITIAL | Inicialização do repositório Git, permissões e submodule. |

---

## 6. Referências

- [`docs/adr/0001-opencode-configs.md`](file:///home/albano/.config/opencode/docs/adr/0001-opencode-configs.md)
- [`docs/plan/opencode-configs.md`](file:///home/albano/.config/opencode/docs/plan/opencode-configs.md)
- [`docs/spec/opencode-cli.md`](file:///home/albano/.config/opencode/docs/spec/opencode-cli.md)
