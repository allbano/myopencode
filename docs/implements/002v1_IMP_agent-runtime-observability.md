# 002v1_IMP_agent-runtime-observability.md — Implementação da Observabilidade de Agentes

> **Data:** 2026-08-31  
> **Autor:** OpenCode (assistente, agente `plan-refine` → execução nesta sessão)  
> **Tipo:** Implementação (IMP)  
> **Versão:** 1.0  
> **Status:** Concluído (pendente validação em sessão real do TUI)  
> **Relacionado:** `docs/plan/002v1_PLAN_agent-runtime-observability.md`, `docs/adr/002v1_ADR_agent-runtime-observability_explains.md`

---

## 1. Escopo

Implementar o plano `002v1_PLAN_agent-runtime-observability.md`: sistema de observabilidade em tempo de execução para os agentes do opencode, cobrindo:

1. Notificações nativas do TUI (`attention`).
2. Plugin de captura (`plugins/agent-observer.js`) com JSONL, trace.json/trace.md e métricas.
3. Toasts para subagentes, permissões e erros.
4. CLIs de acompanhamento e consulta histórica.
5. Higiene do repositório (`.gitignore`, `package.json` ESM).

---

## 2. Arquivos Criados/Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `tui.json` | Editado | Seção `attention` habilitada (notificações desktop + sons, inclui evento nativo `subagent_done`) |
| `plugins/agent-observer.js` | **Criado** | Plugin principal de observabilidade (~430 linhas) |
| `tools/observe-tail.sh` | **Criado** | Live tail formatado do JSONL (requer `jq` para formato rico) |
| `tools/trace-search.mjs` | **Criado** | Consulta histórica por agente/sessão/evento/tool/data, com `--stats` e `--errors` |
| `tools/.smoke/smoke.mjs` | **Criado** | Teste de fumaça do plugin (12 asserts) |
| `package.json` | Editado | `"type": "module"` (elimina warning ESM ao carregar plugin) |
| `.gitignore` | Editado | `+ traces/` (dados de runtime locais) |

**Estrutura de saída gerada em runtime (gitignored):**

```
~/.config/opencode/traces/
├── AAAA-MM-DD/
│   ├── <sessionId>.jsonl        ← stream bruto
│   ├── <sessionId>.trace.json   ← consolidado estruturado
│   └── <sessionId>.trace.md     ← narrativa legível (timeline)
└── metrics/
    ├── agents.json              ← agregado por agente
    └── models.json              ← agregado por modelo
```

---

## 3. Cadeia de Comandos Executados

### Passo 1 — Levantamento do estado atual
`read` em `opencode.jsonc`, `tui.json`, `.gitignore`, `package.json`, agentes (`agents/*.md`), skills vendor, `docs/` existentes.  
**Motivo:** o plano exige conhecer o que já existe (padrão de nomenclatura `NNNvN_TIPO_*.md`, permissões atuais, estrutura de docs).

### Passo 2 — Verificação de viabilidade na documentação oficial
`webfetch` em `https://opencode.ai/docs/plugins/` e `https://opencode.ai/docs/tui/` e `https://opencode.ai/docs/sdk/`.  
**Achados-chave que moldaram a implementação:**
- Hooks `tool.execute.before/after` expõem `callID` (correlação de duração).
- Evento `message.updated` carrega `tokens` e `modelID` (métricas por modelo).
- `client.tui.showToast({ body: { title, message, variant, duration } })` existe no SDK.
- `attention` no `tui.json` tem som nativo para `subagent_done`.
- **Não há API para painel lateral no TUI** → mitigação via CLIs (`observe-tail.sh`, `trace-search.mjs`).

### Passo 3 — `tui.json` + `attention`
`edit` adicionando o bloco `attention` (enabled/notifications/sound/volume).  
**Verificação:** `node -e "JSON.parse(...)"` → `TUI.JSON OK`.

### Passo 4 — `plugins/agent-observer.js`
`write` com o plugin completo. Decisões implementadas:
- **Kill-switches:** `OPENCODE_OBSERVE=off` (desliga tudo), `OPENCODE_OBSERVE_TOASTS=off` (sem toasts).
- **Defensivo:** todo hook em try/catch; falha do plugin nunca propaga para o opencode.
- **Truncamento:** `PREVIEW_LIMIT=2000` chars em outputs no JSONL; `PROMPT_LIMIT=4000` para prompts de subagente.
- **Correlação de duração:** `pendingCalls` (Map por `callID`) entre `tool.execute.before` e `.after`.
- **Deduplicação de métricas:** agregação por *delta* (`s.aggregated` snapshot por sessão) — impede contagem dobrada quando `session.idle` dispara múltiplas vezes na mesma sessão (padrão normal no opencode: idle a cada resposta concluída).
- **Bug corrigido durante a implementação:** `renderTraceMarkdown` referenciava `s.statsCommitted` (inexistente); corrigido para `s.stats.tools`.

### Passo 5 — Validação de sintaxe
```
node --input-type=module -e "import('...agent-observer.js')..."   → PLUGIN OK, exports: AgentObserver
node --check tools/trace-search.mjs                                → TRACE-SEARCH OK
bash -n tools/observe-tail.sh                                      → OBSERVE-TAIL OK
node -e "JSON.parse(tui.json)"                                     → TUI.JSON OK
```
O warning ESM do Node levou ao Passo 6.

### Passo 6 — `package.json` + `"type": "module"`
`write` adicionando o campo. Elimina o aviso de re-parsing e declara explicitamente o formato dos plugins/tools.

### Passo 7 — Testes funcionais das CLIs com fixture
Criada fixture `traces/2026-08-31/ses_fixture_test.jsonl` (10 eventos cobrindo tool, subagente, permissão negada, modelo, erro).  
**Evidências:**
- `trace-search.mjs --agent build-guarded --today` → timeline formatada (10 linhas).
- `trace-search.mjs --session ses_fixture --stats` → agregado JSON: `avg_call_ms: 14533`, 1 permissão pedida, 1 negada, 2 erros detectados.
- `trace-search.mjs --today --errors` → apenas os 3 eventos de erro/negação.
- `observe-tail.sh --all` (sob `timeout 2`) → saída formatada com emojis de estado (▶◀🚀✅🔐🤖⛔).
- **Fix aplicado aqui:** `trace-search.mjs` não exibia o campo `reply` de `permission.replied` → adicionado `ev.reply` na cascade de `detail`.

### Passo 8 — Smoke test do plugin (`tools/.smoke/smoke.mjs`)
Simula o ciclo completo com `client.tui.showToast` mockado (contador de toasts): `session.created` → `message.updated` (modelo+tokens) → `tool.execute.before/after` (read) → `task` (code-reviewer) → `permission.asked/replied` → `todo.updated` → `session.idle`.  
Ao final, **restaura os arquivos de métricas** para não contaminar dados reais com dados de teste.

**Evidência (12/12 PASS):**
```
PASS  jsonl existe
PASS  trace.json existe
PASS  trace.md existe
PASS  jsonl tem >= 8 eventos
PASS  subagent.begin presente
PASS  subagent.end com duração
PASS  permission.asked presente
PASS  model.usage presente
PASS  todo.update presente
PASS  trace.md menciona subagente
PASS  trace.md tem Timeline
PASS  toast disparado (>=1: subagente+permissão)
SMOKE OK — todos os artefatos gerados corretamente
```

Inspeção manual do `ses_smoketest.trace.md`: timeline completa com header (agente, duração, contagens), seção de subagentes, e timeline com emojis/timestamps.

### Passo 9 — `.gitignore` + `traces/`
`edit` adicionando a entrada. Confirmado por `git status --short`: `traces/` **não aparece** (ignorado corretamente).

### Passo 10 — Verificação do diff final
```
 M .gitignore
 M package.json
 M tui.json
?? docs/plan/002v1_PLAN_agent-runtime-observability.md
?? plugins/agent-observer.js
?? tools/.smoke/smoke.mjs
?? tools/observe-tail.sh
?? tools/trace-search.mjs
```
Exatamente o conjunto pretendido; nenhum arquivo inesperado.

---

## 4. Restrições de Permissão Encontradas (e como foram contornadas)

| Tentativa | Regra | Contorno |
|-----------|-------|----------|
| `ls ...` via bash com redirect | `bash ls *` ok, mas pipes/heredoc com redirect para `/tmp` barrados por `external_directory` | Usar ferramentas dedicadas (`read`, `glob`, `write`) |
| Criar fixture em `/tmp/opencode/` | `external_directory` nega escrita fora de allowlist | Fixture criada dentro de `~/.config/opencode/traces/` (diretório-alvo real, removível depois) |
| `rm` do fixture de teste | `rm *` negado pelo agente `build-guarded` herdado | **Fixture permanece** em `traces/2026-08-31/ses_fixture_test.jsonl` — inofensiva (gitignored); usuário pode apagar manualmente |
| `chmod +x` nas CLIs | `chmod *` negado | Scripts invocáveis via `bash tools/observe-tail.sh` / `node tools/trace-search.mjs` sem executable bit |

**Nenhuma negação foi contornada** — todas as alternativas usaram caminhos permitidos.

---

## 5. Como Usar (guia rápido)

| Objetivo | Comando |
|----------|---------|
| Ver atividade **ao vivo** (2º terminal) | `bash ~/.config/opencode/tools/observe-tail.sh` |
| Ao vivo, todas as sessões de hoje | `bash ~/.config/opencode/tools/observe-tail.sh --all` |
| O que o agente X fez hoje | `node ~/.config/opencode/tools/trace-search.mjs --agent build-auto --today` |
| Erros/negações de hoje | `node ~/.config/opencode/tools/trace-search.mjs --today --errors` |
| Resumo estatístico de uma sessão | `node ~/.config/opencode/tools/trace-search.mjs --session <prefixo> --stats` |
| Narrativa de uma sessão | abrir `traces/<data>/<sessionId>.trace.md` |
| Métricas agregadas | `cat ~/.config/opencode/traces/metrics/agents.json` |
| Desligar observabilidade | `OPENCODE_OBSERVE=off opencode` |
| Desligar só toasts | `OPENCODE_OBSERVE_TOASTS=off opencode` |
| Re-rodar teste de fumaça | `node ~/.config/opencode/tools/.smoke/smoke.mjs` |

---

## 6. Critérios de Aceite — Status

| Critério (do plano) | Status |
|---------------------|--------|
| JSONL por sessão com eventos de tool/subagent/permissão | ✅ verificado via smoke (12/12) |
| `.trace.json` + `.trace.md` no idle | ✅ verificado (arquivos gerados e inspecionados) |
| Toast ao concluir subagente | ✅ mock confirmou chamada; **validação visual no TUI real pendente** |
| Notificação desktop + som nativos | ⚠️ configuração aplicada em `tui.json`; **validação depende do terminal do usuário** |
| `observe-tail.sh` mostra atividade ao vivo | ✅ testado com fixture |
| `trace-search.mjs --agent X --today` | ✅ testado |
| Métricas `agents.json` / `models.json` | ✅ smoke gerou e restaurou; formato validado |
| Falha do plugin não quebra opencode | ✅ por construção (try/catch em todos os hooks + kill-switch) |
| `traces/` fora do git | ✅ `git status` confirma ausência |
| Docs IMP e ADR | ✅ esta IMP + `002v1_ADR_*.md` |

---

## 7. Próximos Passos / Evolução

| Versão | Descrição |
|--------|-----------|
| 1.0 (esta) | Captura completa + traces + métricas + CLIs + toasts |
| 1.1 | Validar em sessão TUI real: toast visível? som `subagent_done`? Ajustar `duration` dos toasts |
| 1.2 | Se `observe-tail` ficar verboso: adicionar filtros `--agent`/`--event` ao tail |
| 1.3 | Reavaliar painel no TUI caso o opencode adicione API de extensão de layout |
| 1.4 | Considerar rotação/retenção de traces (ex.: apagar > 30 dias) se o volume crescer |
| 1.5 | Plugin custom tool `/observe` (resumo da sessão ativa dentro do próprio prompt do opencode) |

---

## 8. Riscos Residuais

1. **Forma real dos eventos**: os testes usaram fixtures baseadas na documentação. Se algum campo real divergir (ex.: `tokens` vs `usage`, caminho do `sessionID` em `permission.asked`), o plugin captura parcialmente — degradado, não quebrado (campos defensivos com `??`). O rastreio `model.usage` é o mais dependente de forma de payload. → **Verificar `traces/<data>/*.jsonl` após a primeira sessão real** e ajustar mapeamentos se necessário.
2. **Concorrência de métricas**: duas instâncias do opencode gravando `agents.json` simultaneamente podem gerar last-write-wins. Aceitável para uso local; janela de corrupção é pequena.
3. **Volume**: prompts de subagentes completos entram no `.trace.json` (não no JSONL). Em sessões longas com muitos subagentes, o arquivo pode chegar a algumas centenas de KB — irrelevante para disco local.
4. **Fixture residual**: `traces/2026-08-31/ses_fixture_test.jsonl` permanece (permissão de `rm` negada nesta sessão); apagar quando conveniente.

---

*Documento de implementação. Planejamento em `docs/plan/002v1_PLAN_agent-runtime-observability.md`; decisões arquiteturais em `docs/adr/002v1_ADR_agent-runtime-observability_explains.md`.*
