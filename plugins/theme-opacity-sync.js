// theme-opacity-sync.js — Sincroniza o tema do opencode com a opacidade do terminal.
//
// Lê os state files gravados pelo toggle-terminal-transparency
// (~/.local/state/dotfiles/terminal-transparency/{ghostty,kitty}.conf) e alterna
// entre o tema opaco original e seu gêmeo transparente (<tema>-transparent).
//
// - Opacidade < 1.0 em qualquer state file -> terminal transparente -> gêmeo
// - Opacidade == 1.0 (ou sem state file)   -> terminal opaco -> tema original
// - Respeita a escolha manual via /theme: só alterna entre pares conhecidos
//   (tema atual <-> tema atual + "-transparent"); "system" e temas sem gêmeo
//   são ignorados.
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

const tui = async (api) => {
  let timer = null

  const sync = () => {
    if (!api.theme.ready) return
    const current = api.theme.selected
    if (!current) return

    const transparent = isTransparent()

    if (transparent) {
      // Tema opaco com gêmeo transparente disponível -> troca para o gêmeo.
      if (!current.endsWith(TRANSPARENT_SUFFIX) && api.theme.has(current + TRANSPARENT_SUFFIX)) {
        api.theme.set(current + TRANSPARENT_SUFFIX)
      }
    } else {
      // Tema gêmeo transparente -> volta para o tema opaco original.
      if (current.endsWith(TRANSPARENT_SUFFIX)) {
        const opaque = current.slice(0, -TRANSPARENT_SUFFIX.length)
        if (api.theme.has(opaque)) {
          api.theme.set(opaque)
        }
      }
    }
  }

  sync()
  timer = setInterval(sync, POLL_MS)
  api.lifecycle.onDispose(() => clearInterval(timer))
}

export default { id: "theme-opacity-sync", tui }