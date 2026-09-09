#!/usr/bin/env bun
// sync-transparent-themes.mjs
//
// Gera os temas gêmeos transparentes do opencode em ~/.config/opencode/themes/.
// Para cada tema embutido, cria <nome>-transparent.json: cópia exata do tema
// original com os campos de fundo definidos como "none" (usa o fundo do
// terminal, permitindo a opacidade).
//
// Uso: bun tools/sync-transparent-themes.mjs
// Idempotente: re-executar regenera os 33 arquivos (manutenção quando o
// opencode atualizar temas).
//
// Referência: .opencode/plans/opencode-terminal-opacity.md
//             docs/adr/0004-opencode-terminal-opacity.md

import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

// Temas embutidos do opencode (branch dev, packages/tui/src/theme/assets/).
// O tema "system" é gerado em runtime e já usa "none" — não tem gêmeo.
const THEMES = [
  "aura",
  "ayu",
  "carbonfox",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "catppuccin",
  "cobalt2",
  "cursor",
  "dracula",
  "everforest",
  "flexoki",
  "github",
  "gruvbox",
  "kanagawa",
  "lucent-orng",
  "material",
  "matrix",
  "mercury",
  "monokai",
  "nightowl",
  "nord",
  "one-dark",
  "opencode",
  "orng",
  "osaka-jade",
  "palenight",
  "rosepine",
  "solarized",
  "synthwave84",
  "tokyonight",
  "vercel",
  "vesper",
  "zenburn",
]

const BASE_URL =
  "https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/tui/src/theme/assets"

const OUT_DIR = join(homedir(), ".config", "opencode", "themes")

// Campos de fundo transformados para "none" no gêmeo transparente.
// backgroundMenu é suportado pelo TUI (Theme.backgroundMenu em
// packages/tui/src/theme/index.ts) — o schema web está desatualizado.
// Sem ele, lucent-orng manteria menus semi-opacos (#2a1a1599).
const BACKGROUND_FIELDS = [
  "background",
  "backgroundPanel",
  "backgroundElement",
  "backgroundMenu",
  "diffAddedBg",
  "diffRemovedBg",
  "diffContextBg",
  "diffAddedLineNumberBg",
  "diffRemovedLineNumberBg",
]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  let ok = 0
  const errors = []

  for (const name of THEMES) {
    try {
      const res = await fetch(`${BASE_URL}/${name}.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const theme = await res.json()

      for (const field of BACKGROUND_FIELDS) {
        // backgroundMenu é opcional no tema original; adicionar explicitamente
        // em todos os gêmeos para garantir menus transparentes (não depender
        // do fallback para backgroundElement).
        theme.theme[field] = "none"
      }

      const outPath = join(OUT_DIR, `${name}-transparent.json`)
      await writeFile(outPath, JSON.stringify(theme, null, 2) + "\n")
      ok++
    } catch (err) {
      errors.push(`${name}: ${err.message}`)
    }
  }

  console.log(`Gerados ${ok}/${THEMES.length} temas gêmeos em ${OUT_DIR}`)
  if (errors.length > 0) {
    console.error("Erros:")
    for (const e of errors) console.error(`  - ${e}`)
    process.exitCode = 1
  }
}

main()