# 002v1_ADR_agent-runtime-observability_explains.md — ADR: Observabilidade de Agentes via Plugin + Traces Locais

> **Data:** 2026-08-31  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Architecture Decision Record (ADR)  
> **Versão:** 1.0  
> **Status:** Aceito  
> **Relacionado:** `002v1_PLAN_agent-runtime-observability.md`, `002v1_IMP_agent-runtime-observability.md`

---

## 1. Contexto

O usuário precisava responder 5 perguntas sobre seu uso de agentes no opencode:

1. **Que agente(s) estão ativos agora e o que cada um está fazendo?**
2. **Quando um subagente é chamado, o que foi delegado e o que voltou?**
3. **Quais decisões o agente tomou ao longo da sessão?** (mudanças de plano, perguntas, permissões)
4. **Quanto custa cada agente/modelo?** (tempo, tokens, falhas)
5. **O que aconteceu na sessão X?** (navegável depois, por sessão e por agente)

Toda a instrumentação precisava respeitar dois limites: (a) apenas a API pública/documentada do opencode (sem fork), e (b) nenhum dado deixa a máquina local.

---

## 2. Decisão 1 — Plugin único de eventos, não instrumentação por agente

**Decisão:** Todo o rastreamento vive em `plugins/agent-observer.js`, usando os hooks `tool.execute.*` e o barramento `event`. Os 5 arquivos de agente (`agents/*.md`) **não foram alterados**.

**Por quê:**
- Os eventos já carregam o contexto necessário (sessão, ferramenta, agente via `message.updated`).
- Injetar instruções de "log" em cada prompt de agente aumentaria tokens, poluiria os prompts e seria não-determinístico (depende da boa vontade do modelo).
- Um único ponto de captura = um único ponto de manutenção e de desligamento (`OPENCODE_OBSERVE=off`).

**Alternativa rejeitada — instrumentar cada agente no prompt:** cobre menos (não vê permissões nem durações reais), custa tokens e falha silenciosamente.

---

## 3. Decisão 2 — JSONL append-only como fonte da verdade

**Decisão:** cada evento vira **uma linha JSON** em `traces/<data>/<sessionId>.jsonl`, anexada no momento em que ocorre. Arquivos derivados (`.trace.json`, `.trace.md`, métricas) são regenerados a partir dele.

**Por quê:**
- Append é a operação mais barata e menos propensa a corrupção; perda parcial em crash afeta no máximo a última linha.
- JSONL é consumível por `tail -f`, `jq`, `rg`, pandas, DuckDB — zero lock-in.
- Separação captura/apresentação: o Markdown legível é *derivado*, pode ser re-gerado com template novo sem perder histórico.

**Alternativas rejeitadas:**
| Alternativa | Motivo da rejeição |
|-------------|--------------------|
| SQLite | Escrita com lock; exige migração de schema; menos legível em terminal; overkill para volume local |
| `client.app.log()` (log interno do opencode) | Destino/formato opacos ao usuário; competir com logs do produto; retenção não controlada |
| Envio a OTLP/Jaeger | Telemetria externa viola o requisito "tudo local"; setup desproporcional |

**Consequência — truncamento duplo:** no JSONL, payloads são truncados (2 KB outputs / 4 KB prompts) para manter o stream leve; o `.trace.json` consolidado guarda prompts completos de subagentes. Quem precisa de tudo lê o trace; quem acompanha ao vivo lê o JSONL.

---

## 4. Decisão 3 — Métricas por agregação delta no `session.idle`

**Decisão:** métricas (`metrics/agents.json`, `metrics/models.json`) são atualizadas no evento `session.idle`, somando apenas o **delta** desde a última agregação daquela sessão (snapshot em memória por sessão).

**Contexto que forçou a decisão:** `session.idle` dispara **a cada resposta concluída**, não uma vez por sessão. Uma agregação ingênua (somar totais acumulados da sessão a cada idle) inflaria os contadores em progressão geométrica.

**Limitação assumida:** se o processo morrer entre idle e idle, o delta não agregado se perde (fica apenas no JSONL da sessão). Aceitável: o JSONL é a fonte da verdade e permite recomputar métricas se algum dia precisarmos.

**Concorrência:** leitura-modificação-escrita sem lock em `agents.json`. Para um CLI local single-user, a janela de lost-update é desprezível; se dois opencodes rodarem juntos, um pode sobrescrever o delta do outro. Documentado como risco residual aceito.

---

## 5. Decisão 4 — Sem painel lateral no TUI; compensação em três frentes

**Restrição (verificada em docs):** a API de plugins do opencode expõe eventos, ferramentas customizadas e toasts — **não** há hook de layout/painel. Não é possível adicionar um sidebar nativo sem fork.

**Decisão — três compensações combinadas:**

1. **`attention` nativo** (`tui.json`): habilita som + notificação desktop do **próprio produto** para `permission`, `error`, `done` e `subagent_done`. Cobre "quero saber quando algo termina/erra" com zero código.
2. **Toasts via `client.tui.showToast`**: disparados pelo plugin em subagente concluído (com duração), permissão solicitada e erro de sessão.
3. **CLIs no segundo terminal**: `observe-tail.sh` (tempo real, formato legível) e `trace-search.mjs` (histórico). Um `tmux split` ou janela ao lado resolve o "painel" sem violar a API.

**Alternativa rejeitada — fork do TUI:** manutenção perpétua contra upstream; quebra a cada update; fora do espírito de configuração local.

**Gatilho de revisão:** se o opencode introduzir extensões de UI/layout para plugins (acompanhar releases), reabrir esta decisão.

---

## 6. Decisão 5 — Toasts apenas em eventos de "mudança de atenção"

**Decisão:** toasts são emitidos apenas em 3 situações: subagente concluído, permissão solicitada, erro de sessão. **Não** em cada ferramenta.

**Por quê:** toast é canal de interrupção. Um toast por `read`/`glob` geraria dezenas por minuto e treinaria o usuário a ignorar todos (falha clássica de alerting descrita na skill `observability-and-instrumentation`: *"a noisy pager trains people to ignore it"*). O fluxo detalhado já está no terminal ao lado via `observe-tail.sh`.

**Escape hatch:** `OPENCODE_OBSERVE_TOASTS=off`.

---

## 7. Decisão 6 — Robustez por projeto, não por disciplina

**Decisões de engenharia embutidas no código:**

- **Try/catch total:** nenhum hook propaga exceção — um bug no observador nunca interrompe o trabalho do agente (o observado não pode matar o observador... nem o observador o trabalho).
- **Kill-switch global:** `OPENCODE_OBSERVE=off` curto-circuita na inicialização, sem custo de runtime.
- **Payloads defensivos:** `??`, `?.` e `truncate()` em todos os campos externos — o plugin sobrevive a mudanças de shape dos eventos (degrada para campos ausentes, não crash).
- **Sem dados sensíveis além do necessário:** JSONL truncado; `traces/` no `.gitignore`; nada sai da máquina. Herda-se a postura de segurança do próprio opencode (a permissão para ler `.env` etc. continua sendo decidida pelo sistema de permissões, não pelo plugin).

---

## 8. Alternativas Consideradas e Rejeitadas (resumo)

| Alternativa | Por que foi rejeitada |
|-------------|----------------------|
| Instrumentar prompts dos agentes | Não-determinístico, custa tokens, cobertura parcial |
| SQLite para eventos | Locking, migrações, menos transparente que JSONL |
| `client.app.log()` como store | Opaco, sem controle de formato/retenção |
| Exporter OTLP/Jaeger | Viola "tudo local"; custo de setup alto |
| Fork do TUI para sidebar | Manutenção contra upstream; há toasts + CLIs suficientes |
| Toast por ferramenta executada | Ruído → alarm fatigue |
| Buffer em memória com flush no fim | Perda total em crash; append incremental é mais seguro |

---

## 9. Consequências

**Positivas:**
- Todo evento de agente fica registrado persistentemente, por sessão, navegável por agente e por data.
- Métricas por agente **e por modelo** sem custo por chamada (agregação no idle).
- Acompanhamento em tempo real sem depender de features inexistentes no TUI.
- Sistema desligável e inquebrável (para o host): pior caso é "não registrou", nunca "quebrou o opencode".

**Negativas / aceitas:**
- Sem painel embutido no TUI (limitação da API) → fluxo recomendado usa segundo terminal.
- Métricas podem perder o último delta em kill abrupto do processo.
- Campos de eventos reais precisam ser conferidos na primeira sessão real (fixtures foram baseadas na documentação, não em tráfego capturado).

---

## 10. Referências

- [OpenCode — Plugins](https://opencode.ai/docs/plugins/) — hooks e eventos disponíveis
- [OpenCode — TUI](https://opencode.ai/docs/tui/) — seção `attention` e sons nativos
- [OpenCode — SDK](https://opencode.ai/docs/sdk/) — `tui.showToast`, `session.messages`
- Skill vendor: `observability-and-instrumentation` (sinais certos para cada pergunta; anti-padrões de alerting)
- Implementação: `docs/implements/002v1_IMP_agent-runtime-observability.md`

---

*ADR — Architecture Decision Record. Para o plano, veja `docs/plan/002v1_PLAN_agent-runtime-observability.md`. Para a execução e evidências, veja `docs/implements/002v1_IMP_agent-runtime-observability.md`.*
