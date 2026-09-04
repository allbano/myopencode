# 002v1_PLAN_agent-runtime-observability.md — Observabilidade de Agentes em Tempo de Execução

> **Data:** 2026-08-31  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Planejamento (PLAN)  
> **Versão:** 1.0  
> **Status:** Aguardando aprovação do usuário  
> **Relacionado:** 001v1_PLAN_opencode_configs.md (infra de config), AGENTS.md (regras globais)

---

## 1. Contexto e Motivação

O usuário opera hoje com 5 agentes primários (`plan`, `plan-refine`, `build-ask`, `build-auto`, `build-guarded`) que delegam para subagentes (`explore`, `scout`, `code-reviewer`, `test-reviewer`, `security-auditor`) via a ferramenta `task`. O problema declarado:

> **"Não consigo acompanhar o que cada agente está fazendo em tempo de execução."**

Dores concretas:
1. Ao delegar para subagentes, o usuário só vê o resultado final — não o percurso.
2. Não há registro persistente de decisões de agentes (mudanças de plano, perguntas, recusas de permissão).
3. Não há métricas: quanto tempo cada agente levou? Quantas ferramentas usou? Qual modelo custou mais?
4. A sessão termina e o rastro é perdido (ou exige scroll manual do histórico).

---

## 2. Requisitos Coletados (Entrevista nesta sessão)

Respostas do usuário:

| Pergunta | Resposta |
|----------|----------|
| O que acompanhar? | (a) agentes ativos e ação atual, (b) chamadas de subagentes, (c) **log de todas as decisões e mudanças de plano em todas as sessões**, (d) métricas por agente **e por modelo**, (e) histórico navegável por sessão e por agente |
| Como consumir? | (a) painel/dashboard em tempo real, (b) logs estruturados JSONL, (c) toasts no TUI, (d) **um arquivo de trace por sessão em JSON e Markdown** |
| Granularidade | **Detalhada** — input/output completo de ferramentas |

---

## 3. Análise de Viabilidade (verificada contra docs oficiais)

Fonte: <https://opencode.ai/docs/plugins/>, <https://opencode.ai/docs/tui/> — consultadas em 2026-08-31.

### 3.1 Mecanismo escolhido: **Plugin local de observabilidade**

O opencode suporta plugins locais em `~/.config/opencode/plugins/*.js|ts` com hooks de eventos. Eventos relevantes **confirmados na documentação**:

| Evento | Uso no nosso sistema |
|--------|---------------------|
| `session.created` / `session.idle` / `session.error` / `session.deleted` | Delimitar traces por sessão |
| `tool.execute.before` / `tool.execute.after` | Capturar TODAS as chamadas de ferramentas (read, edit, bash, **task**, skill...) com args e resultado |
| `permission.asked` / `permission.replied` | Registrar decisões de permissão (gate de segurança) |
| `message.updated` / `message.part.updated` | Rastrear tokens/modelo por resposta |
| `todo.updated` | Rastrear mudanças de plano via TodoWrite |
| `command.executed` | Rastrear comandos slash do usuário |
| `tui.toast.show` | Exibir toasts nativos no TUI |
| `session.compacted` | Marcar compactações no trace |

### 3.2 Matriz de viabilidade dos requisitos

| Requisito | Viável? | Mecanismo |
|-----------|---------|-----------|
| Log de todas as ações/decisões | ✅ Sim | Plugin: hooks de eventos → append em JSONL |
| Rastrear chamadas de subagentes | ✅ Sim | `tool.execute.*` com `tool === "task"` revela agente chamado, prompt e resultado |
| Métricas por agente e modelo | ✅ Sim | Timestamp em `tool.execute.before/after` (duração); `message.updated` carrega modelo/tokens |
| Trace por sessão (JSON + MD) | ✅ Sim | Plugin acumula eventos; ao `session.idle`/novo ciclo, grava `trace-<sessionId>.json` + `.md` |
| Toasts no TUI | ✅ Sim | Evento `tui.toast.show` no plugin (ex.: "subagente X concluído em 42s") |
| Histórico navegável | ✅ Parcial* | Arquivos de trace + script CLI de consulta (`search` por agente/sessão/data) |
| Dashboard "painel lateral" no TUI | ❌ **Não suportado** | A API de plugins **não expõe layout do TUI** (sem side panels). **Mitigação:** (1) ferramenta CLI companion `opencode-observe` (live tail em outro terminal/split), (2) comando customizado `/observe` via plugin tool, (3) `attention` nativo com sons/notificações desktop |

### 3.3 Recursos nativos a ativar (zero código)

No `tui.json` hoje ausente, ativar `attention`:

```jsonc
"attention": {
  "enabled": true,
  "notifications": true,
  "sound": true,
  "volume": 0.4
}
```

Isso dá notificações desktop + sons para `question`, `permission`, `error`, `done` e **`subagent_done`** (evento nativo específico para subagentes) — cobrindo parte do requisito "quero ver quando subagente termina" sem escrever código.

---

## 4. Arquitetura Proposta

```
~/.config/opencode/
├── plugins/
│   └── agent-observer.js          ← PLUGIN CENTRAL (único ponto de captura)
│       ├── hooks: tool.execute.before/after, session.*, permission.*,
│       │          message.updated, todo.updated, command.executed
│       ├── escreve: traces/<sessionId>.jsonl  (append incremental)
│       ├── ao session.idle: deriva trace-<sessionId>.md + metrics.json
│       └── dispara tui.toast.show em eventos-chave
│
├── traces/                        ← NOVO (gitignored: dados de runtime)
│   ├── 2026-08-31/
│   │   ├── <sessionId>.jsonl      ← stream bruto (fonte da verdade)
│   │   ├── <sessionId>.trace.json ← consolidado estruturado
│   │   └── <sessionId>.trace.md   ← narrativa legível p/ humanos
│   └── metrics/
│       ├── agents.json            ← agregados por agente
│       └── models.json            ← agregados por modelo
│
├── tools/                         ← scripts de consulta (chmod +x)
│   ├── observe-tail.sh            ← live tail formatado do JSONL ativo
│   └── trace-search.mjs           ← consulta histórica (agente, sessão, evento)
│
└── opencode.jsonc                 ← sem mudanças de schema (plugin é auto-carregado)
└── tui.json                       ← + seção attention
└── .gitignore                     ← + traces/
```

### 4.1 Esquema do evento (JSONL — uma linha por evento)

Convenção inspirada na skill `observability-and-instrumentation` (vendor): eventos nomeados estáveis, campos estruturados, IDs de correlação.

```json
{
  "ts": "2026-08-31T14:23:01.512Z",
  "session_id": "ses_abc123",
  "event": "tool.execute.after",
  "agent": "build-guarded",
  "tool": "task",
  "tool_call_id": "call_9f2",
  "duration_ms": 41230,
  "args": { "subagent_type": "code-reviewer", "description": "..." },
  "result_preview": "primeiros 2000 chars...",
  "ok": true
}
```

Eventos mínimos:
`session.start`, `session.end`, `tool.begin`, `tool.end`, `subagent.begin`, `subagent.end`, `permission.ask`, `permission.reply`, `todo.update`, `model.usage`, `error`, `compaction`.

### 4.2 Métricas derivadas

- **Por agente:** sessões, tool calls, duração total/média por ferramenta, taxa de erro, permissões pedidas/concedidas/negadas.
- **Por modelo:** tokens (input/output) via `message.updated`, tempo de resposta, sessões atendidas.
- **Por sessão:** sequência de ferramentas (timeline), subagentes invocados, diffs (`session.diff`).

### 4.3 Trace Markdown (template)

```markdown
# Sessão ses_abc123 — build-guarded — 2026-08-31 14:20 → 14:47
## Resumo: 12 ferramentas, 2 subagentes, 1 edição negada, duração 27m
## Timeline
- 14:20 [tool] read src/auth.ts (312ms)
- 14:23 [subagent→code-reviewer] início — "revisar auth flow"
- 14:25 [subagent←code-reviewer] fim (41,2s) — 3 achados
## Decisões
- 14:30 permission.asked edit:src/db.ts → negada pelo usuário
## Métricas
...
```

---

## 5. Tarefas (ordem de execução)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 1 | Habilitar `attention` no `tui.json` (sons/notificações nativas, incl. `subagent_done`) | `tui.json` | Reiniciar TUI; invocar subagente; confirmar toast/som |
| 2 | Criar plugin `plugins/agent-observer.js` com hooks de sessão + tool | `plugins/agent-observer.js` | Sessão nova gera `traces/<data>/<id>.jsonl` com eventos |
| 3 | Adicionar captura de `task` (subagentes) com duração e resultado | plugin | JSONL contém `subagent.begin/end` com `duration_ms` |
| 4 | Adicionar captura de permissões, todos, message.updated (modelo/tokens) | plugin | Eventos presentes no JSONL |
| 5 | Toasts via `tui.toast.show` em: subagente concluído, permissão pedida, erro de sessão | plugin | Toast visível no TUI durante execução |
| 6 | Gerador de trace consolidado (`.trace.json` + `.trace.md`) ao `session.idle` | plugin | Arquivos criados ao fim da sessão; MD legível |
| 7 | Agregador de métricas `metrics/agents.json` + `models.json` | plugin | Agregados atualizam a cada sessão |
| 8 | CLI `tools/observe-tail.sh` (live tail formatado do JSONL ativo) | `tools/` | Rodar em 2º terminal; mostra atividade em tempo real |
| 9 | CLI `tools/trace-search.mjs` (buscar por agente/sessão/evento/data) | `tools/` | Consultas retornam resultados corretos |
| 10 | Atualizar `.gitignore` (+`traces/`) | `.gitignore` | `git status` não lista traces |
| 11 | Documento IMP com evidências | `docs/implements/002v1_IMP_*.md` | Criado após execução |
| 12 | ADR com decisões (por que plugin, por que JSONL, limits do TUI) | `docs/adr/002v1_ADR_*.md` | Criado após execução |

**Fatias:** tarefas 1–4 = MVP observável (uma fatia). 5–7 = experiência TUI. 8–9 = consumo externo. 10–12 = higiene/documentação.

---

## 6. Decisões Técnicas (preview do ADR)

1. **Plugin único vs. instrumentar cada agente:** Plugin único. Eventos já carregam o agente ativo — editar 5 arquivos de agente só adicionaria ruído de prompt sem ganho de sinal.
2. **JSONL e não SQLite:** append-only, legível por `tail`/`jq`, zero dependência. SQLite rejeitado (complexidade + lock em escrita concorrente).
3. **`client.app.log()` vs. arquivo próprio:** `client.app.log` vai para o log interno do opencode (opaco ao usuário). Escrevemos nossos próprios arquivos em `traces/` — controle total do formato e retenção.
4. **Não interceptar conteúdo sensível:** resultados de ferramentas truncados (`result_preview`, ~2000 chars) no JSONL; o trace completo fica no `.trace.json` local (nunca commitado, `traces/` no `.gitignore`).
5. **Sem telemetria externa:** tudo local. Nenhum envio a serviços remotos.
6. **"Painel lateral" substituído por:** toasts nativos + `attention` + CLI companion. Documentado como limitação da API de plugins.

---

## 7. Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Plugin com erro quebra o startup do opencode | Média | Alto | Try/catch em todos os hooks; falha do plugin nunca propaga (log e segue); flag `OPENCODE_OBSERVE=off` para desligar |
| Volume de I/O em sessões longas | Média | Médio | Append assíncrono; rotação por dia; truncar payloads > 2 KB |
| Eventos internos sem campo `agent` em alguns casos | Média | Médio | Fallback para sessão ativa; registrar `agent: "unknown"` e revisar na v1.1 |
| Dados sensíveis em traces | Baixa | Alto | JSONL truncado; `.gitignore` em `traces/`; sem envio externo; herdar deny-list de segredos |
| API de eventos mudar em update do opencode | Baixa | Médio | Plugin defensivo (checa existência de campos); `autoupdate: notify` já configurado |

---

## 8. Critérios de Aceite

- [ ] Toda sessão gera `traces/AAAA-MM-DD/<id>.jsonl` com eventos de tool/subagent/permissão.
- [ ] Ao fim da sessão, existem `.trace.json` e `.trace.md` com timeline, decisões e métricas.
- [ ] Toast aparece no TUI quando subagente termina (com duração).
- [ ] Notificação desktop + som nativos em `permission`/`error`/`subagent_done`.
- [ ] `tools/observe-tail.sh` mostra atividade ao vivo num segundo terminal.
- [ ] `tools/trace-search.mjs --agent build-auto --today` lista ações do agente no dia.
- [ ] `metrics/agents.json` e `metrics/models.json` agregam duração, tokens e erros.
- [ ] Falha forçada no plugin não impede o opencode de funcionar.
- [ ] `traces/` não aparece em `git status`.
- [ ] Documentos IMP e ADR criados seguindo o padrão `002v1_*`.

---

## 9. Fora de Escopo (v1)

- Painel lateral embutido no TUI (API não suporta — reavaliar se opencode adicionar UI extensions).
- Exportação para OTLP/Jaeger (over-engineering para uso local).
- UI web de histórico (Marko/HTML viewer) — apenas se o volume justificar (v2+).
- Alertas ativos (ex.: "agente rodando há > 10 min") — v1 é passiva.

---

## 10. Referências

- [OpenCode — Plugins](https://opencode.ai/docs/plugins/) — eventos, estrutura, `tui.toast.show`
- [OpenCode — TUI](https://opencode.ai/docs/tui/) — `attention` (sons/notificações, `subagent_done`)
- Skill vendor consultada: `observability-and-instrumentation` (eventos estruturados, pergunta-antes-de-instrumentar)
- Documentos irmãos: `001v1_PLAN_opencode_configs.md`

---

*Documento de planejamento. Após aprovação, a execução será registrada em `002v1_IMP_agent-runtime-observability.md` e as decisões em `002v1_ADR_agent-runtime-observability_explains.md`.*
