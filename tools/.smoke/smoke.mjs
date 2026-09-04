// smoke.mjs — teste de fumaça do agent-observer (session_id: ses_smoketest)
// Executa o pipeline completo com cliente mockado e valida os artefatos gerados.

import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { AgentObserver } from "../../plugins/agent-observer.js"

const TRACES = join(homedir(), ".config", "opencode", "traces")
const METRICS_A = join(TRACES, "metrics", "agents.json")
const METRICS_M = join(TRACES, "metrics", "models.json")
const SID = "ses_smoketest"

// snapshot das métricas para restaurar ao final (não poluir dados reais)
const snapA = existsSync(METRICS_A) ? await readFile(METRICS_A, "utf8") : null
const snapM = existsSync(METRICS_M) ? await readFile(METRICS_M, "utf8") : null

let toasts = 0
const client = { tui: { showToast: async () => { toasts++; return true } } }
const hooks = await AgentObserver({ client })

const ev = (type, properties) => hooks.event({ event: { type, properties } })

// simula: sessão criada → mensagem (modelo) → edit (ok) → task code-reviewer → permissão → idle
await ev("session.created", { info: { id: SID, title: "smoke" } })
await ev("message.updated", { info: { sessionID: SID, role: "assistant", agent: "build-guarded", providerID: "nvidia", modelID: "moonshotai/kimi-k3", tokens: { input: 100, output: 50, reasoning: 10 } } })
await hooks["tool.execute.before"]({ tool: "read", sessionID: SID, callID: "c1" }, { args: { filePath: "src/a.ts" } })
await hooks["tool.execute.after"]({ tool: "read", sessionID: SID, callID: "c1" }, { output: "conteúdo", metadata: {} })
await hooks["tool.execute.before"]({ tool: "task", sessionID: SID, callID: "c2" }, { args: { subagent_type: "code-reviewer", description: "smoke", prompt: "revise" } })
await hooks["tool.execute.after"]({ tool: "task", sessionID: SID, callID: "c2" }, { output: "achados...", metadata: {} })
await ev("permission.asked", { sessionID: SID, permission: "edit", patterns: ["src/x.ts"] })
await ev("permission.replied", { sessionID: SID, reply: "once" })
await ev("todo.updated", { sessionID: SID, todos: [{ content: "t1", status: "pending", priority: "high" }] })
await ev("session.idle", { sessionID: SID })

// validações
const day = new Date().toISOString().slice(0, 10)
const jsonl = join(TRACES, day, `${SID}.jsonl`)
const traceJson = join(TRACES, day, `${SID}.trace.json`)
const traceMd = join(TRACES, day, `${SID}.trace.md`)

const checks = []
checks.push(["jsonl existe", existsSync(jsonl)])
checks.push(["trace.json existe", existsSync(traceJson)])
checks.push(["trace.md existe", existsSync(traceMd)])

const lines = (await readFile(jsonl, "utf8")).trim().split("\n")
checks.push(["jsonl tem >= 8 eventos", lines.length >= 8])
const events = lines.map((l) => JSON.parse(l))
checks.push(["subagent.begin presente", events.some((e) => e.event === "subagent.begin" && e.subagent === "code-reviewer")])
checks.push(["subagent.end com duração", events.some((e) => e.event === "subagent.end" && typeof e.duration_ms === "number")])
checks.push(["permission.asked presente", events.some((e) => e.event === "permission.asked")])
checks.push(["model.usage presente", events.some((e) => e.event === "model.usage")])
checks.push(["todo.update presente", events.some((e) => e.event === "todo.update")])

const md = await readFile(traceMd, "utf8")
checks.push(["trace.md menciona subagente", md.includes("code-reviewer")])
checks.push(["trace.md tem Timeline", md.includes("## Timeline")])
checks.push(["toast disparado (>=1: subagente+permissão)", toasts >= 2])

// restaura métricas (não poluir dados reais com o smoke test)
if (snapA !== null) await writeFile(METRICS_A, snapA)
if (snapM !== null) await writeFile(METRICS_M, snapM)

let fail = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
  if (!ok) fail++
}
console.log(fail === 0 ? "\nSMOKE OK — todos os artefatos gerados corretamente" : `\nSMOKE FALHOU em ${fail} checks`)
process.exit(fail === 0 ? 0 : 1)
