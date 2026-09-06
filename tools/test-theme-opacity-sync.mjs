// Teste de unidade do plugin theme-opacity-sync.js (núcleo puro nextAction).
// Uso: node tools/test-theme-opacity-sync.mjs
// Roda de ~/.config/opencode (usa process.cwd()); não cria arquivos persistentes.
import { pathToFileURL } from "node:url"
import { join } from "node:path"

const { nextAction } = await import(pathToFileURL(join(process.cwd(), "plugins", "theme-opacity-sync.js")).href)

let passed = 0
let failed = 0

function check(name, cond) {
  if (cond) { passed++; console.log(`  ok: ${name}`) }
  else { failed++; console.log(`  FALHOU: ${name}`) }
}

// Estado inicial típico de um poll que nunca atuou.
const initial = { terminal: null, base: null, lastSet: null }
// Simulador de api.theme.has.
const has = (name) => ["opencode-transparent", "dracula-transparent", "nord-transparent", "opencode", "dracula", "nord"].includes(name)

// --- Fix: primeiro poll NÃO força troca (tema persistido do usuário vence) ---
{
  const r = nextAction("opencode", true, has, initial) // terminal transparente, tema opaco persistido
  check("start transparente + tema opaco: não força troca (set=null)", r.set === null)
  check("start registra terminal=true", r.state.terminal === true && r.state.base === "opencode")
}

// --- Fix: escolha manual NUNCA é sobrescrita enquanto o terminal não muda ---
{
  // Simula: plugin antes setou opencode-transparent; usuário escolhe dracula (opaco) via /theme
  let state = { terminal: true, base: "opencode", lastSet: "opencode-transparent" }
  let r = nextAction("dracula", true, has, state)
  check("manual dracula (opaco) em terminal transparente: NÃO troca (set=null)", r.set === null)
  check("manual dracula registrado como base", r.state.base === "dracula" && r.state.lastSet === null)
}

// --- Fix: tema manual com sufixo -transparent também vira base sem força ---
{
  let state = { terminal: false, base: "opencode", lastSet: null }
  let r = nextAction("nord-transparent", false, has, state) // usuário elege gêmeo em terminal opaco
  check("manual nord-transparent: base='nord', sem troca", r.state.base === "nord" && r.set === null)
}

// --- Transição de terminal (toggle A): transparente -> opaco usa o tema de base ---
{
  let state = { terminal: true, base: "dracula", lastSet: "dracula-transparent" }
  let r = nextAction("dracula-transparent", false, has, state) // terminal ficou opaco
  check("transição opaco: volta para dracula", r.set === "dracula")
  check("transição opaco: estado terminal=false", r.state.terminal === false)
}

// --- Transição de terminal (toggle A): opaco -> transparente usa o gêmeo ---
{
  let state = { terminal: false, base: "dracula", lastSet: null }
  let r = nextAction("dracula", true, has, state) // terminal ficou transparente
  check("transição transparente: troca para dracula-transparent", r.set === "dracula-transparent")
}

// --- Poll após set próprio: sem mudança manual e sem repetição ---
{
  let state = { terminal: true, base: "dracula", lastSet: "dracula-transparent" }
  let r = nextAction("dracula-transparent", true, has, state) // tema atual == lastSet, terminal estável
  check("poll estável: nenhum set repetido", r.set === null)
}

// --- system (sem gêmeo): transição vira no-op ---
{
  let state = { terminal: false, base: "system", lastSet: null }
  let r = nextAction("system", true, has, state) // terminal ficou transparente
  check("system: sem gêmeo, transição não faz nada", r.set === null)
}

// --- Tema custom sem gêmeo: transição vira no-op ---
{
  let state = { terminal: false, base: "meu-tema", lastSet: null }
  let r = nextAction("meu-tema", true, has, state)
  check("tema sem gêmeo: transição não faz nada", r.set === null)
}

// --- Sem state files (terminal opaco fixo): nada é forçado em hipótese alguma ---
{
  let state = { terminal: false, base: "opencode", lastSet: null }
  let r = nextAction("opencode", false, has, state)
  check("opaco estável: nenhum set", r.set === null)
}

// --- Ciclo completo: fluxo real com toggle A + escolhas manuais ---
{
  // start: terminal transparente, tema persistido "opencode" (opaco) -> não força
  let s = { terminal: null, base: null, lastSet: null }
  let r = nextAction("opencode", true, has, s)
  check("ciclo: start registra sem forçar", r.set === null)
  s = r.state

  // usuário escolhe "nord" (manual, terminal ainda transparente) -> vence
  r = nextAction("nord", true, has, s)
  check("ciclo: manual nord vence (base=nord)", r.set === null && r.state.base === "nord")
  s = r.state

  // toggle A: terminal fica opaco -> tema de base "nord" já é o atual
  r = nextAction("nord", false, has, s)
  check("ciclo: terminal opaco mantém nord", r.set === null && r.state.terminal === false)
  s = r.state

  // toggle A: terminal volta transparente -> gêmeo nord-transparent
  r = nextAction("nord", true, has, s)
  check("ciclo: terminal transparente -> nord-transparent", r.set === "nord-transparent")
  s = r.state

  // poll estável após set próprio -> sem repetição
  r = nextAction("nord-transparent", true, has, s)
  check("ciclo: estável após set próprio", r.set === null)
  s = r.state

  // cenário do bug reportado: usuário escolhe opencode (opaco) com terminal
  // transparente -> a escolha DEVE vencer (não volta para o transparente)
  r = nextAction("opencode", true, has, s)
  check("ciclo: manual opencode (opaco) vence em terminal transparente", r.set === null && r.state.base === "opencode")
}

console.log(`\nResultado: ${passed} ok, ${failed} falhas`)
process.exit(failed > 0 ? 1 : 0)