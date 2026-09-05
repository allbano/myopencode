---
title: "Plano de Observabilidade em Tempo de Execução de Agentes"
slug: "agent-runtime-observability"
version: 1.0.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Plano: Observabilidade de Agentes em Tempo de Execução

> **Tipo:** Planejamento (PLAN)  
> **Status:** Aprovado e Executado  
> **Relacionado:** [`docs/spec/agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/spec/agent-runtime-observability.md), [`docs/adr/0002-agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/adr/0002-agent-runtime-observability.md), [`docs/adr/0003-desktop-notifications.md`](file:///home/albano/.config/opencode/docs/adr/0003-desktop-notifications.md)

---

## 1. Contexto e Motivação

O usuário opera com 5 agentes primários (`plan`, `plan-refine`, `build-ask`, `build-auto`, `build-guarded`) que delegam para subagentes (`explore`, `scout`, `code-reviewer`, `test-reviewer`, `security-auditor`) via a ferramenta `task`.

**Dores identificadas:**
1. Ao delegar para subagentes, o usuário só vê o resultado final — não o percurso.
2. Não havia registro persistente de decisões de agentes (mudanças de plano, perguntas, recusas de permissão).
3. Não havia métricas: quanto tempo cada agente levou? Quantas ferramentas usou? Qual modelo custou mais?
4. A sessão terminava e o rastro era perdido (ou exigia scroll manual do histórico).

---

## 2. Requisitos Coletados

| Pergunta | Resposta |
|----------|----------|
| O que acompanhar? | (a) agentes ativos e ação atual, (b) chamadas de subagentes, (c) **log de todas as decisões e mudanças de plano em todas as sessões**, (d) métricas por agente **e por modelo**, (e) histórico navegável por sessão e por agente |
| Como consumir? | (a) painel/dashboard em tempo real, (b) logs estruturados JSONL, (c) notificações desktop/toasts, (d) **um arquivo de trace por sessão em JSON e Markdown** |
| Granularidade | **Detalhada** — input/output completo de ferramentas |

---

## 3. Arquitetura Proposta

### 3.1 Mecanismo: Plugin local de observabilidade
O OpenCode suporta plugins locais em `~/.config/opencode/plugins/*.js|ts` com hooks de eventos:
- `tool.execute.before` / `tool.execute.after` (rastreio de tools e subagentes).
- `permission.asked` / `permission.replied` (decisões de permissão).
- `message.updated` (tokens e modelo consumidos).
- `todo.updated` (atualizações de checklist/tarefas).
- `session.idle` (consolidação de traces e métricas).

### 3.2 Estrutura de Armazenamento
```text
~/.config/opencode/traces/
├── AAAA-MM-DD/
│   ├── <sessionId>.jsonl        ← stream bruto em append-only
│   ├── <sessionId>.trace.json   ← consolidado estruturado da sessão
│   └── <sessionId>.trace.md     ← narrativa legível com timeline
└── metrics/
    ├── agents.json              ← agregado por agente
    └── models.json              ← agregado por modelo
```

### 3.3 Ferramental de Acompanhamento (CLI)
- `observe-tail.sh` (`opencode-observe`): live tail formatado no terminal secundário.
- `trace-search.mjs` (`opencode-trace`): busca histórica por data, sessão, agente, ferramentas e erros.

---

## 4. Fases de Execução

1. **Fase 1:** Ativação de `attention` no `tui.json` (sons nativos).
2. **Fase 2:** Desenvolvimento do plugin `plugins/agent-observer.js`.
3. **Fase 3:** Ferramentas CLI de consulta em `tools/`.
4. **Fase 4:** Teste de fumaça automatizado em `tools/.smoke/smoke.mjs`.
5. **Fase 5 (Refinamento):** Instalação das CLIs no PATH (`~/.local/bin`) e despacho de notificações para o Desktop Linux (`notify-send`), eliminando toasts da TUI.

---

## 5. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-08-31 | INITIAL | Plano inicial aprovado para implementação da observabilidade. |

---

## 6. Referências

- [OpenCode — Plugins](https://opencode.ai/docs/plugins/)
- Especificação canônica: [`docs/spec/agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/spec/agent-runtime-observability.md)
- ADRs: [`docs/adr/0002-agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/adr/0002-agent-runtime-observability.md), [`docs/adr/0003-desktop-notifications.md`](file:///home/albano/.config/opencode/docs/adr/0003-desktop-notifications.md)
