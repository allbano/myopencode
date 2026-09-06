// theme-opacity-sync.js — Sincroniza o tema do opencode com a opacidade do terminal.
//
// Lê os state files gravados pelo toggle-terminal-transparency
// (~/.local/state/dotfiles/terminal-transparency/{ghostty,kitty}.conf) e alterna
// entre o tema opaco original e seu gêmeo transparente (<tema>-transparent).
//
// Regras (v2 — corrige sobrescrita da escolha manual):
// - A escolha manual de tema via /theme SEMPRE vence: o plugin nunca troca o
//   tema espontaneamente, apenas registra a escolha do usuário como tema de base.
// - O plugin só age quando o ESTADO DO TERMINAL muda entre polls (toggle A no
//   tmux): terminal transparente -> gêmeo <tema>-transparent; terminal opaco ->
//   tema de base original.
// - No primeiro poll, o estado do terminal é apenas registrado (sem forçar troca),
//   então o tema persistido do usuário não é sobrescrito no start.
// - "system" e temas sem gêmeo são ignorados (transições viram no-op).
//
// Referência: .opencode/plans/opencode-terminal-opacity.md
//             docs/adr/0004-opencode-terminal-opacity.md

import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// THEME_OPACITY_STATE_DIR permite sobrescrever o diretório dos state files
// (usado em testes; em produção usa o diretório padrão do toggle).
const STATE_DIR =
  process.env.THEME_OPACITY_STATE_DIR ?? join(homedir(), ".local", "state", "dotfiles", "terminal-transparency")
const STATE_FILES = ["ghostty.conf", "kitty.conf"]
const TRANSPARENT_SUFFIX = "-transparent"
const POLL_MS = 1000

// Detecta se o terminal está transparente (opacidade < 1.0 em algum state file).
function isTransparent() {
  for (const file of STATE_FILES) {
    const path = join(STATE_DIR, file)
    if (!existsSync(path)) continue
    const content = readFileSync(path, "utf8")
    const match = content.match(/(?:opacity|background-opacity)\s*=\s*([0-9.]+)/)
    if (match && Number.parseFloat(match[1]) < 1.0) {
      return true
    }
  }
  return false
}

// Remove o sufixo "-transparent" de um tema (se presente).
function stripSuffix(name) {
  return name.endsWith(TRANSPARENT_SUFFIX) ? name.slice(0, -TRANSPARENT_SUFFIX.length) : name
}

// Núcleo puro da sincronização. Estado persistido entre polls:
//   { terminal: boolean|null, base: string|null, lastSet: string|null }
// Retorna { set: string|null, state: {terminal, base, lastSet} }:
//   - set:    tema a aplicar (null = nenhuma ação; a escolha manual vence)
//   - state:  novo estado para persistir no próximo poll
function nextAction(current, transparent, has, state) {
  let { terminal, base, lastSet } = state

  // Se o tema atual NÃO foi setado pelo próprio plugin, é escolha do usuário:
  // vira o tema de base e não é forçado neste poll.
  const ourSet = lastSet !== null && current === lastSet
  if (!ourSet) {
    base = stripSuffix(current)
    lastSet = null
  }

  // Primeiro poll: apenas registra o estado do terminal (sem forçar troca).
  if (terminal === null) {
    return { set: null, state: { terminal: transparent, base, lastSet } }
  }

  // Terminal no mesmo estado -> não interferir na escolha do usuário.
  if (transparent === terminal) {
    return { set: null, state: { terminal, base, lastSet } }
  }

  // O ESTADO DO TERMINAL mudou -> sincroniza base <-> base-transparent.
  const target = transparent ? `${base}${TRANSPARENT_SUFFIX}` : base
  const next = { terminal: transparent, base, lastSet }
  if (target !== current && has(target)) {
    return { set: target, state: { ...next, lastSet: target } }
  }
  return { set: null, state: next }
}

const tui = async (api) => {
  let state = { terminal: null, base: null, lastSet: null }
  let timer = null

  const sync = () => {
    if (!api.theme.ready) return
    const current = api.theme.selected
    if (!current) return

    const transparent = isTransparent()
    const { set, state: next } = nextAction(current, transparent, api.theme.has.bind(api.theme), state)
    state = next
    if (set !== null) {
      api.theme.set(set)
    }
  }

  sync()
  timer = setInterval(sync, POLL_MS)
  api.lifecycle.onDispose(() => clearInterval(timer))
}

export default { id: "theme-opacity-sync", tui }

// Exportados para o teste de unidade (tools/test-theme-opacity-sync.mjs); o
// loader do opencode lê apenas o default export.
export { nextAction, stripSuffix }