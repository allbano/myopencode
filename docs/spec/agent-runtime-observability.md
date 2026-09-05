---
title: "Especificação do Sistema de Observabilidade de Agentes e Notificações"
slug: "agent-runtime-observability"
version: 1.1.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Especificação Técnica: Observabilidade de Agentes em Tempo de Execução e Notificações

> **Tipo:** Especificação Canônica (SPEC)  
> **Status:** Ativo  
> **Relacionado:** [`docs/adr/0002-agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/adr/0002-agent-runtime-observability.md), [`docs/adr/0003-desktop-notifications.md`](file:///home/albano/.config/opencode/docs/adr/0003-desktop-notifications.md), [`docs/plan/agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/plan/agent-runtime-observability.md)

---

## 1. Visão Geral

O sistema de observabilidade de agentes do OpenCode monitora em tempo real a execução de ferramentas, delegações para subagentes, permissões concedidas/negadas e consumo de tokens/modelos.

Toda a telemetria é estritamente **local**, operando em segundo plano sem exigir fork ou modificações nos arquivos de prompt dos agentes.

### Pilares da Arquitetura:
1. **Captura Centralizada:** Plugin local [`plugins/agent-observer.js`](file:///home/albano/.config/opencode/plugins/agent-observer.js) conectado aos hooks de ciclo de vida do SDK do OpenCode.
2. **Fonte da Verdade em Append-Only:** Stream de eventos em JSONL por data e sessão em `traces/AAAA-MM-DD/<sessionId>.jsonl`.
3. **Consolidação em Idle:** Geração automática de relatório estruturado (`.trace.json`) e narrativa em Markdown (`.trace.md`) no encerramento de cada ciclo de resposta.
4. **Notificações Desktop Nativas:** Despacho não-bloqueante para o gerenciador de janelas do Linux via `/usr/sbin/notify-send`.
5. **Interface Limpa:** Desativação de balões intrusivos (toasts) na TUI por padrão.
6. **Ferramental CLI:** Utilitários para live tail (`opencode-observe`) e consulta histórica (`opencode-trace`).

---

## 2. Estrutura de Diretórios de Runtime (`traces/`)

```text
~/.config/opencode/traces/
├── AAAA-MM-DD/
│   ├── <sessionId>.jsonl        ← stream bruto de eventos (append-only)
│   ├── <sessionId>.trace.json   ← consolidado estruturado da sessão
│   └── <sessionId>.trace.md     ← narrativa legível com timeline
└── metrics/
    ├── agents.json              ← métricas agregadas por agente
    └── models.json              ← métricas agregadas por modelo
```

---

## 3. Especificação do Plugin (`agent-observer.js`)

### 3.1 Eventos e Hooks Interceptados

| Evento / Hook | Finalidade |
|---|---|
| `session.created` | Registra metadados iniciais da sessão (ID, título, início). |
| `tool.execute.before` | Inicia contagem de tempo da ferramenta/subagente via `callID`. |
| `tool.execute.after` | Calcula latência (`duration_ms`), captura preview de saída e registra `subagent.end` se `tool === "task"`. |
| `permission.asked` | Contabiliza e emite alerta de autorização pendente. |
| `permission.replied` | Registra se a permissão foi aceita ou negada (`denied`). |
| `message.updated` | Acumula consumo de tokens (`input`, `output`, `reasoning`) e modelo utilizado. |
| `todo.updated` | Registra alterações no plano/checklist de tarefas da sessão. |
| `session.error` | Captura falhas não tratadas e emite notificação crítica. |
| `session.idle` | Dispara agregação incremental de métricas e persistência dos arquivos `.trace.json` e `.trace.md`. |

### 3.2 Robustez e Segurança
- **Try/Catch Defensivo:** Nenhuma exceção do observador propaga para o OpenCode.
- **Truncamento:** Parâmetros e saídas têm limites seguros (2.000 caracteres no stream, 4.000 caracteres para prompts de subagentes).
- **Zero Vazamento de Segredos:** Dados de ambiente ou credenciais não são registrados.

---

## 4. Sistema de Notificações

### 4.1 Notificações Desktop Nativas (Linux)
Implementadas via `notify-send` com chamada assíncrona desacoplada (`spawn` com `detached: true`, `stdio: "ignore"` e `unref()`):

```javascript
spawn("notify-send", ["-a", "OpenCode", "-u", urgency, "-i", icon, title, message])
```

- **Subagente Concluído:** Urgência `low` (ou `normal` se falhar), ícone `dialog-information`.
- **Permissão Solicitada:** Urgência `normal`, ícone `dialog-warning`.
- **Erro de Sessão:** Urgência `critical`, ícone `dialog-error`.

### 4.2 Toasts de Terminal (TUI)
- Por padrão, chamadas para `client.tui.showToast` estão **desativadas** para manter o terminal livre de poluição visual.
- Para habilitar toasts temporizados na TUI (opt-in): definir `OPENCODE_OBSERVE_TOASTS=on`.

### 4.3 Alertas Sonoros
- Sons nativos mantidos via [`tui.json`](file:///home/albano/.config/opencode/tui.json) (`attention.sound: true`).

---

## 5. Ferramental CLI de Apoio

### 5.1 `opencode-observe` (Live Tail)
- **Localização:** [`tools/observe-tail.sh`](file:///home/albano/.config/opencode/tools/observe-tail.sh)
- **Uso:** Acompanha em tempo real a sessão ativa ou consolida todas as sessões do dia (`--all`). Requer `jq` para formatação com emojis e cores.

### 5.2 `opencode-trace` (Consulta Histórica)
- **Localização:** [`tools/trace-search.mjs`](file:///home/albano/.config/opencode/tools/trace-search.mjs)
- **Filtros suportados:** `--today`, `--agent <nome>`, `--session <id>`, `--tool <nome>`, `--errors`, `--stats`.

### 5.3 Instalação no PATH
Para disponibilizar os comandos globalmente:
```bash
cp ~/.config/opencode/tools/trace-search.mjs ~/.local/bin/opencode-trace
chmod +x ~/.local/bin/opencode-trace

cp ~/.config/opencode/tools/observe-tail.sh ~/.local/bin/opencode-observe
chmod +x ~/.local/bin/opencode-observe
```

---

## 6. Variáveis de Ambiente e Kill-Switches

| Variável | Padrão | Efeito |
|---|---|---|
| `OPENCODE_OBSERVE` | `on` | Se `=off`, desliga completamente o plugin sem custo de CPU. |
| `OPENCODE_OBSERVE_DESKTOP` | `on` | Se `=off`, desativa o envio para `notify-send`. |
| `OPENCODE_OBSERVE_TOASTS` | `off` | Se `=on`, reativa os balões intrusivos na interface TUI. |
| `OPENCODE_TRACES_DIR` | `~/.config/opencode/traces` | Redireciona o diretório base de armazenamento de traces. |

---

## 7. Teste de Fumaça Automatizado

A suíte em [`tools/.smoke/smoke.mjs`](file:///home/albano/.config/opencode/tools/.smoke/smoke.mjs) valida 12 critérios essenciais:
```bash
node tools/.smoke/smoke.mjs
```
Critérios validados:
- Criação e integridade de `.jsonl`, `.trace.json` e `.trace.md`.
- Contagem mínima de eventos de ciclo de vida.
- Eventos `subagent.begin` e `subagent.end` com cálculo de duração.
- Presença de permissões, modelo e atualização de tarefas.
- Timeline Markdown gerada corretamente.
- Integração de despacho de toasts e notificações.

---

## 8. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.1.0** | 2026-09-04 | MINOR | Adiciona despacho para `notify-send` no Linux desktop e desativa toasts de TUI por padrão. |
| **1.0.1** | 2026-08-31 | PATCH | Padronização e scripts de instalação das CLIs em `~/.local/bin`. |
| **1.0.0** | 2026-08-31 | INITIAL | Implementação inicial da observabilidade via plugin, traces JSONL/MD e ferramentas CLI. |

---

## 9. Referências

- [`docs/adr/0002-agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/adr/0002-agent-runtime-observability.md)
- [`docs/adr/0003-desktop-notifications.md`](file:///home/albano/.config/opencode/docs/adr/0003-desktop-notifications.md)
- [`docs/plan/agent-runtime-observability.md`](file:///home/albano/.config/opencode/docs/plan/agent-runtime-observability.md)
- [`docs/spec/opencode-cli.md`](file:///home/albano/.config/opencode/docs/spec/opencode-cli.md)
