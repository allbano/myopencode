#!/usr/bin/env node
// trace-search.mjs — consulta histórica dos traces de agentes
//
// Uso:
//   node trace-search.mjs [opções]
//
// Opções:
//   --agent <nome>     filtra por agente (ex.: build-guarded)
//   --session <id>     filtra por id de sessão (prefixo basta)
//   --event <nome>     filtra por evento (ex.: subagent.end, permission.asked)
//   --tool <nome>      filtra por ferramenta (ex.: edit, bash, task)
//   --date <AAAA-MM-DD>  limita a um dia (padrão: todos)
//   --today            atalho para --date $(hoje)
//   --errors           apenas eventos com erro / permissões negadas
//   --stats            imprime resumo agregado em vez de eventos
//   --limit <n>        máximo de eventos impressos (padrão: 200)
//
// Exemplos:
//   node trace-search.mjs --agent build-auto --today
//   node trace-search.mjs --event permission.asked --date 2026-08-31
//   node trace-search.mjs --session ses_abc --stats

import { readFile, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const BASE = join(homedir(), ".config", "opencode", "traces")

const args = process.argv.slice(2)
const opt = {}
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  switch (a) {
    case "--agent": opt.agent = args[++i]; break
    case "--session": opt.session = args[++i]; break
    case "--event": opt.event = args[++i]; break
    case "--tool": opt.tool = args[++i]; break
    case "--date": opt.date = args[++i]; break
    case "--today": opt.date = new Date().toISOString().slice(0, 10); break
    case "--errors": opt.errors = true; break
    case "--stats": opt.stats = true; break
    case "--limit": opt.limit = Number(args[++i]); break
    case "--help": case "-h":
      console.log(readmeSync())
      process.exit(0)
  }
}
opt.limit ??= 200

function readmeSync() {
  return `Uso: node trace-search.mjs [--agent X] [--session id] [--event ev] [--tool t]
       [--date AAAA-MM-DD | --today] [--errors] [--stats] [--limit n]`
}

async function collectFiles() {
  const days = opt.date
    ? [opt.date]
    : existsSync(BASE)
      ? (await readdir(BASE, { withFileTypes: true }))
          .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
          .map((d) => d.name)
          .sort()
      : []
  const files = []
  for (const day of days) {
    const dir = join(BASE, day)
    if (!existsSync(dir)) continue
    const entries = await readdir(dir)
    for (const f of entries) {
      if (f.endsWith(".jsonl")) files.push(join(dir, f))
    }
  }
  return files.sort()
}

function match(ev) {
  if (opt.agent && ev.agent !== opt.agent) return false
  if (opt.session && !String(ev.session_id || "").startsWith(opt.session)) return false
  if (opt.event && ev.event !== opt.event) return false
  if (opt.tool && ev.tool !== opt.tool) return false
  if (opt.errors) {
    const isError =
      ev.event === "session.error" ||
      (ev.event === "tool.end" && ev.ok === false) ||
      (ev.event === "subagent.end" && ev.ok === false) ||
      (ev.event === "permission.replied" && (ev.reply === "reject" || ev.reply === "deny"))
    if (!isError) return false
  }
  return true
}

function line(ev) {
  const t = (ev.ts || "").slice(0, 19).replace("T", " ")
  const head = `${t} [${ev.agent ?? "?"}] ${ev.event}`
  const detail =
    ev.tool ??
    ev.subagent ??
    ev.permission ??
    ev.reply ??
    ev.model ??
    ev.error ??
    (ev.command ? `/${ev.command}` : "") ??
    ""
  const dur = ev.duration_ms != null ? ` ${ev.duration_ms}ms` : ""
  const ok = ev.ok === false ? " ❌" : ""
  return `${head} ${detail}${dur}${ok}`
}

const stats = {
  events: 0,
  by_agent: {},
  by_event: {},
  by_tool: {},
  calls_ms_total: 0,
  calls_ms_count: 0,
  subagents: {},
  permissions: { asked: 0, denied: 0 },
  errors: 0,
}

function acc(ev) {
  stats.events += 1
  stats.by_agent[ev.agent ?? "?"] = (stats.by_agent[ev.agent ?? "?"] || 0) + 1
  stats.by_event[ev.event] = (stats.by_event[ev.event] || 0) + 1
  if (ev.tool) stats.by_tool[ev.tool] = (stats.by_tool[ev.tool] || 0) + 1
  if (typeof ev.duration_ms === "number") {
    stats.calls_ms_total += ev.duration_ms
    stats.calls_ms_count += 1
  }
  if (ev.subagent) stats.subagents[ev.subagent] = (stats.subagents[ev.subagent] || 0) + 1
  if (ev.event === "permission.asked") stats.permissions.asked += 1
  if (ev.event === "permission.replied" && (ev.reply === "reject" || ev.reply === "deny"))
    stats.permissions.denied += 1
  if (ev.event === "session.error" || ev.ok === false) stats.errors += 1
}

const files = await collectFiles()
if (files.length === 0) {
  console.error(`Nenhum trace encontrado em ${BASE}${opt.date ? ` (${opt.date})` : ""}`)
  process.exit(1)
}

let printed = 0
outer: for (const file of files) {
  const content = await readFile(file, "utf8")
  for (const ln of content.split("\n")) {
    if (!ln.trim()) continue
    let ev
    try {
      ev = JSON.parse(ln)
    } catch {
      continue
    }
    if (!match(ev)) continue
    if (opt.stats) {
      acc(ev)
    } else {
      console.log(line(ev))
      if (++printed >= opt.limit) break outer
    }
  }
}

if (opt.stats) {
  const avg =
    stats.calls_ms_count > 0 ? Math.round(stats.calls_ms_total / stats.calls_ms_count) : 0
  console.log(JSON.stringify({ ...stats, avg_call_ms: avg }, null, 2))
}
