// Teste de unidade do plugin theme-opacity-sync.js
// Cria state files mock e exercita a lógica de decisão com um api mock.
// Uso: node tools/test-theme-opacity-sync.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const STATE_DIR = join(process.cwd(), ".opencode", "test-state")
const PLUGIN_URL = pathToFileURL(join(process.cwd(), "plugins", "theme-opacity-sync.js")).href

rmSync(STATE_DIR, { recursive: true, force: true })
mkdirSync(STATE_DIR, { recursive: true })

process.env.THEME_OPACITY_STATE_DIR = STATE_DIR
const { default: plugin } = await import(PLUGIN_URL)

let passed = 0
let failed = 0

function makeApi(selected, hasMap) {
  const calls = []
  return {
    theme: {
      ready: true,
      selected,
      has: (name) => hasMap[name] === true,
      set: (name) => { calls.push(name); return true },
    },
    lifecycle: { onDispose: () => {} },
    _calls: calls,
  }
}

function runSync(api) {
  // Invoca a função tui e dispara o sync inicial (o timer fica ativo; o
  // processo termina logo em seguida, então não há vazamento relevante).
  plugin.tui(api)
}

function check(name, cond) {
  if (cond) { passed++; console.log(`  ok: ${name}`) }
  else { failed++; console.log(`  FALHOU: ${name}`) }
}

// --- Cenário 1: ghostty transparente (0.8) -> troca para gêmeo ---
writeFileSync(join(STATE_DIR, "ghostty.conf"), "background-opacity = 0.8\n")
{
  const api = makeApi("opencode", { "opencode-transparent": true })
  runSync(api)
  check("ghostty 0.8: troca opencode -> opencode-transparent", api._calls.includes("opencode-transparent"))
}

// --- Cenário 2: kitty transparente (0.8) -> troca para gêmeo ---
rmSync(join(STATE_DIR, "ghostty.conf"))
writeFileSync(join(STATE_DIR, "kitty.conf"), "opacity=0.8\n")
{
  const api = makeApi("tokyonight", { "tokyonight-transparent": true })
  runSync(api)
  check("kitty 0.8: troca tokyonight -> tokyonight-transparent", api._calls.includes("tokyonight-transparent"))
}

// --- Cenário 3: opaco (1.0) -> volta para o original ---
writeFileSync(join(STATE_DIR, "kitty.conf"), "opacity=1.0\n")
{
  const api = makeApi("tokyonight-transparent", { tokyonight: true })
  runSync(api)
  check("opaco 1.0: volta tokyonight-transparent -> tokyonight", api._calls.includes("tokyonight"))
}

// --- Cenário 4: sem state files -> opaco, não troca tema opaco ---
rmSync(join(STATE_DIR, "kitty.conf"))
{
  const api = makeApi("opencode", { "opencode-transparent": true })
  runSync(api)
  check("sem state files: não troca opencode", api._calls.length === 0)
}

// --- Cenário 5: transparente mas tema sem gêmeo -> não troca ---
writeFileSync(join(STATE_DIR, "ghostty.conf"), "background-opacity = 0.8\n")
{
  const api = makeApi("system", {})
  runSync(api)
  check("transparente + system: não troca", api._calls.length === 0)
}
{
  const api = makeApi("meu-tema-custom", {})
  runSync(api)
  check("transparente + tema sem gêmeo: não troca", api._calls.length === 0)
}

// --- Cenário 6: já transparente + já no gêmeo -> não troca de novo ---
{
  const api = makeApi("opencode-transparent", { opencode: true })
  runSync(api)
  check("transparente + já no gêmeo: não troca", api._calls.length === 0)
}

// --- Cenário 7: opaco + já no original -> não troca ---
rmSync(join(STATE_DIR, "ghostty.conf"))
{
  const api = makeApi("opencode", { "opencode-transparent": true })
  runSync(api)
  check("opaco + já no original: não troca", api._calls.length === 0)
}

// --- Cenário 8: ghostty 0.8 + kitty 1.0 -> transparente (qualquer < 1.0 vence) ---
writeFileSync(join(STATE_DIR, "ghostty.conf"), "background-opacity = 0.8\n")
writeFileSync(join(STATE_DIR, "kitty.conf"), "opacity=1.0\n")
{
  const api = makeApi("nord", { "nord-transparent": true })
  runSync(api)
  check("ghostty 0.8 + kitty 1.0: transparente vence", api._calls.includes("nord-transparent"))
}

console.log(`\nResultado: ${passed} ok, ${failed} falhas`)
process.exit(failed > 0 ? 1 : 0)