// agent-observer.js — Observabilidade de agentes em tempo de execução (plano 002v1)
//
// Captura eventos do opencode e grava:
//   traces/AAAA-MM-DD/<sessionId>.jsonl      — stream bruto (fonte da verdade)
//   traces/AAAA-MM-DD/<sessionId>.trace.json — consolidado ao ficar idle
//   traces/AAAA-MM-DD/<sessionId>.trace.md   — narrativa legível
//   traces/metrics/agents.json | models.json — agregados
//
// Desligar: OPENCODE_OBSERVE=off
// Sem toasts: OPENCODE_OBSERVE_TOASTS=off

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const ENABLED = process.env.OPENCODE_OBSERVE !== "off"
const TOASTS = process.env.OPENCODE_OBSERVE_TOASTS !== "off"

const BASE = join(homedir(), ".config", "opencode", "traces")
const PREVIEW_LIMIT = 2000 // chars de payload no JSONL
const PROMPT_LIMIT = 4000 // prompts de subagente no JSONL

// ---------- utilidades ----------

const nowIso = () => new Date().toISOString()
const dayOf = (iso) => iso.slice(0, 10)

const truncate = (value, limit = PREVIEW_LIMIT) => {
  if (value === undefined || value === null) return value
  const text = typeof value === "string" ? value : safeStringify(value)
  if (text === undefined) return undefined
  return text.length > limit ? text.slice(0, limit) + `…[+${text.length - limit} chars]` : text
}

const safeStringify = (value) => {
  try {
    return JSON.stringify(value, null, 0)
  } catch {
    return undefined
  }
}

const safeParse = (text, fallback) => {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

async function appendJsonl(file, entry) {
  await mkdir(join(file, ".."), { recursive: true })
  await appendFile(file, JSON.stringify(entry) + "\n", "utf8")
}

async function readJson(file, fallback) {
  if (!existsSync(file)) return fallback
  return safeParse(await readFile(file, "utf8"), fallback)
}

async function writeJson(file, data) {
  await mkdir(join(file, ".."), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8")
}

// ---------- estado em memória (por processo do opencode) ----------

const pendingCalls = new Map() // callID -> { tool, sessionID, agent, start, args }
const sessions = new Map() // sessionID -> { id, agent, parent, start, events[], stats, subagents }
const lastAgentBySession = new Map() // sessionID -> agent

function getSession(sessionID) {
  if (!sessions.has(sessionID)) {
    sessions.set(sessionID, {
      id: sessionID,
      agent: lastAgentBySession.get(sessionID) || "unknown",
      parent: undefined,
      started_at: nowIso(),
      events: [],
      subagents: [],
      stats: {
        tool_calls: 0,
        tool_errors: 0,
        tools: {},
        permissions_asked: 0,
        permissions_denied: 0,
        tokens_input: 0,
        tokens_output: 0,
        tokens_reasoning: 0,
        models: {},
      },
    })
  }
  return sessions.get(sessionID)
}

// ---------- gravação ----------

function jsonlPath(sessionID, ts = nowIso()) {
  return join(BASE, dayOf(ts), `${sessionID}.jsonl`)
}

async function emit(sessionID, event, data = {}) {
  if (!sessionID) return
  const entry = { ts: nowIso(), session_id: sessionID, agent: getSession(sessionID).agent, event, ...data }
  getSession(sessionID).events.push(entry)
  try {
    await appendJsonl(jsonlPath(sessionID, entry.ts), entry)
  } catch {
    // nunca quebrar o opencode por causa do observador
  }
}

// ---------- métricas agregadas ----------

async function bumpMetrics() {
  try {
    const dirAgents = join(BASE, "metrics")
    const agentsFile = join(dirAgents, "agents.json")
    const modelsFile = join(dirAgents, "models.json")
    const agents = await readJson(agentsFile, {})
    const models = await readJson(modelsFile, {})

    for (const s of sessions.values()) {
      const prev = s.aggregated ?? {
        sessions: 0, tool_calls: 0, tool_errors: 0,
        permissions_asked: 0, permissions_denied: 0,
        tokens_input: 0, tokens_output: 0, models: {},
      }
      const delta = (k) => (s.stats[k] || 0) - (prev[k] || 0)

      const a = (agents[s.agent] ??= {
        sessions: 0, tool_calls: 0, tool_errors: 0,
        permissions_asked: 0, permissions_denied: 0,
        tokens_input: 0, tokens_output: 0, updated_at: null,
      })
      if (!prev.sessions_counted) a.sessions += 1
      a.tool_calls += delta("tool_calls")
      a.tool_errors += delta("tool_errors")
      a.permissions_asked += delta("permissions_asked")
      a.permissions_denied += delta("permissions_denied")
      a.tokens_input += delta("tokens_input")
      a.tokens_output += delta("tokens_output")
      a.updated_at = nowIso()

      for (const [model, usage] of Object.entries(s.stats.models)) {
        const prevM = prev.models[model] ?? { input: 0, output: 0, reasoning: 0 }
        const m = (models[model] ??= {
          sessions: 0, tokens_input: 0, tokens_output: 0,
          tokens_reasoning: 0, updated_at: null,
        })
        if (!prev.sessions_counted) m.sessions += 1
        m.tokens_input += (usage.input || 0) - prevM.input
        m.tokens_output += (usage.output || 0) - prevM.output
        m.tokens_reasoning += (usage.reasoning || 0) - prevM.reasoning
        m.updated_at = nowIso()
      }

      s.aggregated = {
        sessions_counted: true,
        tool_calls: s.stats.tool_calls,
        tool_errors: s.stats.tool_errors,
        permissions_asked: s.stats.permissions_asked,
        permissions_denied: s.stats.permissions_denied,
        tokens_input: s.stats.tokens_input,
        tokens_output: s.stats.tokens_output,
        models: structuredClone(s.stats.models),
      }
    }

    await writeJson(agentsFile, agents)
    await writeJson(modelsFile, models)
  } catch {
    // métricas são best-effort
  }
}

// ---------- trace consolidado ----------

function renderTraceMarkdown(s) {
  const end = nowIso()
  const ms = new Date(end) - new Date(s.started_at)
  const lines = []
  lines.push(`# Trace — sessão ${s.id}`)
  lines.push("")
  lines.push(`- **Agente:** ${s.agent}`)
  if (s.parent) lines.push(`- **Sessão-pai:** ${s.parent}`)
  lines.push(`- **Início:** ${s.started_at}`)
  lines.push(`- **Fim (idle):** ${end}`)
  lines.push(`- **Duração:** ${(ms / 1000).toFixed(1)}s`)
  lines.push(`- **Ferramentas:** ${Object.values(s.stats.tools).reduce((a, b) => a + b, 0)} chamadas`)
  lines.push(`- **Subagentes:** ${s.subagents.length}`)
  lines.push("")

  if (s.subagents.length > 0) {
    lines.push("## Subagentes invocados")
    lines.push("")
    for (const sub of s.subagents) {
      lines.push(`- **${sub.agent}** — ${sub.description || sub.prompt || ""} (${((sub.duration_ms || 0) / 1000).toFixed(1)}s, ${sub.ok ? "ok" : "erro"})`)
    }
    lines.push("")
  }

  lines.push("## Timeline")
  lines.push("")
  for (const ev of s.events) {
    const t = ev.ts.slice(11, 19)
    switch (ev.event) {
      case "tool.begin":
        lines.push(`- ${t} ▶ **${ev.tool}** ${ev.target ? `\`${ev.target}\`` : ""}`)
        break
      case "tool.end":
        lines.push(`- ${t} ◀ **${ev.tool}** — ${ev.duration_ms}ms ${ev.ok ? "" : "❌"}`)
        break
      case "subagent.begin":
        lines.push(`- ${t} 🚀 subagente **${ev.subagent}**: ${ev.description || ""}`)
        break
      case "subagent.end":
        lines.push(`- ${t} ✅ subagente **${ev.subagent}** concluído em ${(ev.duration_ms / 1000).toFixed(1)}s`)
        break
      case "permission.asked":
        lines.push(`- ${t} 🔐 permissão pedida: **${ev.permission}** ${ev.patterns ? `(${ev.patterns})` : ""}`)
        break
      case "permission.replied":
        lines.push(`- ${t} 🔐 permissão **${ev.reply}**`)
        break
      case "todo.update":
        lines.push(`- ${t} 📋 todos atualizados (${ev.count} itens)`)
        break
      case "session.error":
        lines.push(`- ${t} ⛔ erro: ${ev.error}`)
        break
      case "session.compacted":
        lines.push(`- ${t} 📦 sessão compactada`)
        break
    }
  }
  lines.push("")
  lines.push("---")
  lines.push(`*Gerado por agent-observer em ${end}*`)
  return lines.join("\n")
}

async function persistTrace(sessionID) {
  const s = sessions.get(sessionID)
  if (!s || s.events.length === 0) return
  try {
    const day = dayOf(s.started_at)
    const base = join(BASE, day, `${sessionID}.trace`)
    await writeJson(`${base}.json`, { ...s, ended_at: nowIso() })
    await writeFile(`${base}.md`, renderTraceMarkdown(s), "utf8")
  } catch {
    // melhor esforço
  }
}

// ---------- toasts ----------

async function toast(client, title, message, variant = "info", duration = 5000) {
  if (!TOASTS) return
  try {
    await client.tui.showToast({ body: { title, message, variant, duration } })
  } catch {
    // TUI pode não estar conectada (modo headless/CLI)
  }
}

// ---------- plugin ----------

export const AgentObserver = async ({ client }) => {
  if (!ENABLED) return {}

  try {
    await mkdir(join(BASE, "metrics"), { recursive: true })
  } catch {}

  return {
    // captura iniciada antes da execução da ferramenta
    "tool.execute.before": async (input, output) => {
      try {
        const { tool, sessionID, callID } = input
        const agent = lastAgentBySession.get(sessionID) || getSession(sessionID).agent
        const args = output?.args ?? {}
        pendingCalls.set(callID, { tool, sessionID, agent, start: Date.now(), args })

        const s = getSession(sessionID)
        s.agent = agent !== "unknown" ? agent : s.agent
        s.stats.tool_calls += 1
        s.stats.tools[tool] = (s.stats.tools[tool] || 0) + 1

        if (tool === "task") {
          const sub = args.subagent_type || args.agent || "desconhecido"
          await emit(sessionID, "subagent.begin", {
            subagent: sub,
            description: truncate(args.description, 300),
            prompt: truncate(args.prompt, PROMPT_LIMIT),
          })
        } else {
          const target = args.filePath || args.path || args.command || args.pattern || args.url || ""
          await emit(sessionID, "tool.begin", { tool, target: truncate(String(target), 200) })
        }
      } catch {}
    },

    "tool.execute.after": async (input, output) => {
      try {
        const { tool, sessionID, callID } = input
        const pending = pendingCalls.get(callID)
        pendingCalls.delete(callID)
        const duration_ms = pending ? Date.now() - pending.start : undefined
        const ok = output?.metadata?.error === undefined || output?.metadata?.error === null

        if (!ok) getSession(sessionID).stats.tool_errors += 1

        if (tool === "task") {
          const sub = pending?.args?.subagent_type || pending?.args?.agent || "desconhecido"
          const s = getSession(sessionID)
          s.subagents.push({
            agent: sub,
            description: pending?.args?.description,
            prompt: pending?.args?.prompt, // completo no trace.json
            duration_ms,
            ok,
          })
          await emit(sessionID, "subagent.end", {
            subagent: sub,
            duration_ms,
            ok,
            result_preview: truncate(output?.output),
          })
          await toast(
            client,
            `Subagente ${sub}`,
            `Concluído em ${((duration_ms || 0) / 1000).toFixed(1)}s ${ok ? "" : "(com erro)"}`,
            ok ? "success" : "error",
          )
        } else {
          await emit(sessionID, "tool.end", {
            tool,
            duration_ms,
            ok,
            output_preview: truncate(output?.output),
          })
        }
      } catch {}
    },

    // demais eventos do servidor/TUI
    event: async ({ event }) => {
      try {
        const p = event.properties ?? {}
        switch (event.type) {
          case "session.created": {
            const info = p.info ?? {}
            const s = getSession(info.id)
            if (info.parentID) s.parent = info.parentID
            await emit(info.id, "session.start", { parent: info.parentID, title: info.title })
            break
          }

          case "message.updated": {
            const info = p.info ?? {}
            const sessionID = info.sessionID
            if (!sessionID) break
            // mensagens de assistente carregam agente/modelo/tokens
            const agent = info.agent || info.mode
            if (agent) {
              lastAgentBySession.set(sessionID, agent)
              const s = getSession(sessionID)
              if (s.agent === "unknown") s.agent = agent
            }
            if (info.role === "assistant") {
              const modelID = info.modelID ? `${info.providerID}/${info.modelID}` : undefined
              const usage = info.tokens ?? info.usage
              if (usage) {
                const s = getSession(sessionID)
                const input = usage.input ?? usage.inputTokens ?? 0
                const output = usage.output ?? usage.outputTokens ?? 0
                const reasoning = usage.reasoning ?? usage.reasoningTokens ?? 0
                s.stats.tokens_input += input
                s.stats.tokens_output += output
                s.stats.tokens_reasoning += reasoning
                if (modelID) {
                  const m = (s.stats.models[modelID] ??= { input: 0, output: 0, reasoning: 0 })
                  m.input += input
                  m.output += output
                  m.reasoning += reasoning
                }
                await emit(sessionID, "model.usage", { model: modelID, input, output, reasoning })
              }
            }
            break
          }

          case "permission.asked": {
            const s = p.sessionID ? getSession(p.sessionID) : undefined
            if (s) s.stats.permissions_asked += 1
            await emit(p.sessionID, "permission.asked", {
              permission: p.permission,
              patterns: Array.isArray(p.patterns) ? p.patterns.join(", ") : p.patterns,
            })
            await toast(
              client,
              "Permissão solicitada",
              `${p.permission}${p.patterns ? `: ${p.patterns}` : ""}`,
              "warning",
              8000,
            )
            break
          }

          case "permission.replied": {
            const denied = p.reply === "reject" || p.reply === "deny"
            const s = p.sessionID ? getSession(p.sessionID) : undefined
            if (s && denied) s.stats.permissions_denied += 1
            await emit(p.sessionID, "permission.replied", { reply: p.reply, request: p.requestID })
            break
          }

          case "todo.updated": {
            const count = Array.isArray(p.todos) ? p.todos.length : 0
            await emit(p.sessionID, "todo.update", {
              count,
              items: Array.isArray(p.todos)
                ? p.todos.map((t) => ({
                    content: truncate(t.content, 150),
                    status: t.status,
                    priority: t.priority,
                  }))
                : [],
            })
            break
          }

          case "command.executed":
            await emit(p.sessionID, "command.executed", { command: p.name, args: truncate(p.arguments) })
            break

          case "session.compacted":
            await emit(p.sessionID, "session.compacted", {})
            break

          case "session.error":
            await emit(p.sessionID, "session.error", { error: truncate(p.error?.message ?? p.error) })
            await toast(client, "Erro na sessão", truncate(p.error?.message ?? String(p.error), 300), "error", 10000)
            break

          case "session.updated": {
            // título pode revelar o assunto da sessão
            const info = p.info ?? {}
            if (info.id && info.title) {
              getSession(info.id).title = info.title
            }
            break
          }

          case "session.idle": {
            await emit(p.sessionID, "session.idle", {})
            await persistTrace(p.sessionID)
            await bumpMetrics()
            break
          }

          case "session.deleted": {
            await emit(p.sessionID, "session.deleted", {})
            await persistTrace(p.sessionID)
            sessions.delete(p.sessionID)
            break
          }
        }
      } catch {
        // o observador nunca quebra o opencode
      }
    },
  }
}
