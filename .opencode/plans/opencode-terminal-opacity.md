---
title: "Temas do opencode refletindo a opacidade do terminal (todos os temas)"
slug: "opencode-terminal-opacity"
version: 1.3.0
status: "implemented"
last_reviewed: 2026-09-06
owners:
  - "@albano"
---

# Plano: Temas do opencode refletindo a opacidade do terminal

> **Tipo:** Planejamento (PLAN)
> **Status:** Aprovado e Implementado (build-auto, 2026-09-06)
> **Origem:** Sessão `ses_f8b79af30ffemE3825rc3hqgIj` (2026-09-06), plano original em
> `/home/albano/projects/Go/cmdsh/docs/plan/opencode-terminal-opacity.md`
> **Relacionado:** [`docs/adr/0004-opencode-terminal-opacity.md`](file:///home/albano/.config/opencode/docs/adr/0004-opencode-terminal-opacity.md)

---

## 1. Contexto e Motivação

O opencode (TUI) pinta fundos opacos (`#0a0a0a`, `#141414`, `#1e1e1e`, etc.) em todos os
temas embutidos. O terminal (kitty/ghostty/alacritty) só aplica `background_opacity` onde o
aplicativo **não** pinta fundo. Logo, ao alternar a opacidade via
`toggle-terminal-transparency` (keybind `A` no tmux), a transparência nunca aparece no
opencode.

A sessão `ses_f8b79af30ffemE3825rc3hqgIj` aprovou a abordagem **tema gêmeo + plugin TUI**
para o tema padrão `opencode`. O usuário estendeu o pedido: **duplicar todos os temas
embutidos do opencode**, criando para cada um uma cópia que aceita a opacidade do terminal
(campos de fundo = `"none"`).

**Objetivo:** ao alternar a opacidade do terminal, o tema do opencode troca sozinho entre o
tema opaco original e seu gêmeo transparente, preservando as cores exatas de qualquer tema
selecionado via `/theme`.

---

## 2. Inventário

### 2.1 Temas embutidos do opencode (fonte: `packages/tui/src/theme/assets/` no branch `dev`)

33 temas com arquivo JSON:

| # | Tema | # | Tema | # | Tema |
|---|------|---|------|---|------|
| 1 | `aura` | 12 | `github` | 23 | `opencode` |
| 2 | `ayu` | 13 | `gruvbox` | 24 | `orng` |
| 3 | `carbonfox` | 14 | `kanagawa` | 25 | `osaka-jade` |
| 4 | `catppuccin-frappe` | 15 | `lucent-orng` | 26 | `palenight` |
| 5 | `catppuccin-macchiato` | 16 | `material` | 27 | `rosepine` |
| 6 | `catppuccin` | 17 | `matrix` | 28 | `solarized` |
| 7 | `cobalt2` | 18 | `mercury` | 29 | `synthwave84` |
| 8 | `cursor` | 19 | `monokai` | 30 | `tokyonight` |
| 9 | `dracula` | 20 | `nightowl` | 31 | `vercel` |
| 10 | `everforest` | 21 | `nord` | 32 | `vesper` |
| 11 | `flexoki` | 22 | `one-dark` | 33 | `zenburn` |

O tema `system` é especial (gerado em runtime, sem arquivo) e **já usa `"none"`** nos fundos —
não precisa de gêmeo.

### 2.2 Estado atual

| Item | Estado |
|------|--------|
| `~/.config/opencode/themes/` | Não existe |
| `~/.config/opencode/plugins/theme-opacity-sync.js` | Não existe (só `agent-observer.js`) |
| `~/.config/opencode/tui.json` | Sem `theme` e sem `plugin` |
| State files do toggle | `~/.local/state/dotfiles/terminal-transparency/{ghostty,kitty}.conf` (existem, com `opacity=0.8`) |
| Permissão `external_directory` | `"*": "allow"` (ajustada pelo usuário em 2026-09-06) |

### 2.3 Schema de tema (confirmado em `packages/web/public/theme.json` + `packages/tui/src/theme/index.ts`)

Campos de fundo transformados para `"none"` no gêmeo:

- `background`
- `backgroundPanel`
- `backgroundElement`
- `backgroundMenu`
- `diffAddedBg`
- `diffRemovedBg`
- `diffContextBg`
- `diffAddedLineNumberBg`
- `diffRemovedLineNumberBg`

> **Correção durante a implementação (2026-09-06):** o schema web
> (`packages/web/public/theme.json`) **não** lista `backgroundMenu`, mas o código-fonte do
> TUI (`packages/tui/src/theme/index.ts`) **suporta** o campo: o tipo `Theme` inclui
> `backgroundMenu: RGBA`, `ThemeJson` o declara como opcional, e `resolveTheme` o resolve
> com fallback para `backgroundElement`. O TUI não valida contra o schema (apenas `isTheme`
> checa se `theme` é objeto). Portanto `backgroundMenu` foi **incluído** nos campos
> transformados — sem isso, `lucent-orng` manteria menus semi-opacos (`#2a1a1599`).
> `"transparent"` e `"none"` são equivalentes no resolver (`RGBA(0,0,0,0)`).

---

## 3. Solução

### 3.1 Gerador de temas gêmeos transparentes

Script `~/.config/opencode/tools/sync-transparent-themes.mjs` (Node, ESM):

1. Lista fixa dos 33 temas (hardcoded, com URL raw do branch `dev`).
2. Para cada tema: baixa o JSON, transforma os 9 campos de fundo para `"none"` (incluindo
   `backgroundMenu`, adicionado explicitamente em todos os gêmeos), mantém `$schema`,
   `defs` e todos os demais campos intactos.
3. Grava `~/.config/opencode/themes/<nome>-transparent.json` (nome do tema = basename do
   arquivo, conforme hierarquia de temas do opencode).
4. Idempotente: re-executar regenera os 33 arquivos (manutenção futura quando o opencode
   atualizar temas).

### 3.2 Plugin TUI `~/.config/opencode/plugins/theme-opacity-sync.js`

Máquina de estados com núcleo puro (`nextAction`), generalizada para qualquer tema com
gêmeo `<tema>-transparent`:

- Lê os state files (`ghostty.conf`, `kitty.conf`) e extrai a opacidade com regex
  `(?:opacity|background-opacity)\s*=\s*([0-9.]+)`; opacidade `< 1.0` em qualquer state
  file → terminal transparente.
- **A escolha manual via `/theme` SEMPRE vence:** se o tema atual não foi setado pelo
  próprio plugin, ele é registrado como tema de base e não é forçado no poll — inclusive
  escolhas "opacas" em terminal transparente.
- **O plugin só age quando o ESTADO DO TERMINAL muda entre polls** (toggle `A` no tmux):
  transparente → gêmeo `<base>-transparent`; opaco → tema de base original.
- No primeiro poll o estado do terminal é apenas registrado (nenhuma força no start — a
  piscada de ~1s da v1 deixou de existir).
- `system` e temas sem gêmeo são ignorados (transições viram no-op).
- Polling a cada 1s; `api.lifecycle.onDispose` limpa o timer.
- Módulo: `export default { id: "theme-opacity-sync", tui }` (id obrigatório para file
  plugin). `nextAction`/`stripSuffix` são exportados nomeados (ignorados pelo loader) para
  o teste de unidade.

### 3.3 Editar `~/.config/opencode/tui.json`

Adicionar apenas o plugin (preservando `keybinds` e `attention`); **não** definir `theme`:

```json
"plugin": ["./plugins/theme-opacity-sync.js"]
```

> **Importante (v1.3.0):** não pinar `theme` no `tui.json`. No start, o TUI resolve o tema
> assim: `config.theme ?? kv.get("theme", "opencode")` (`packages/tui/src/context/theme.tsx`),
> com um `createEffect` que reaplica `config.theme` quando definido. Se `theme` existir no
> config, a escolha persistida no KV (manual via `/theme` **ou** a do plugin, ambos gravam
> `kv.set("theme", ...)`) é sempre ignorada no restart. Sem `theme` no config, o KV vence e a
> escolha sobrevive ao `/exit` (default continua `opencode`).

O caminho relativo resolve em relação ao config file (`~/.config/opencode/`).

---

## 4. Tarefas (rastreabilidade)

| ID | Tarefa | Requisito | Evidência |
|----|--------|-----------|-----------|
| T1 | Criar `tools/sync-transparent-themes.mjs` e gerar os 33 temas gêmeos em `themes/` | R1: todos os temas têm cópia transparente | ✅ 33 arquivos `<nome>-transparent.json`; `JSON.parse` OK em todos; 9 campos de fundo = `"none"` |
| T2 | Criar `plugins/theme-opacity-sync.js` | R2: troca automática opaco↔transparente | ✅ `node --check` OK; teste de unidade `tools/test-theme-opacity-sync.mjs` com **18/18** cenários (escolha manual vence; sync só em transição do terminal) |
| T3 | Editar `tui.json` (**sem** pin de `theme`, só `plugin`) | R3: plugin carregado no start; tema persistido no KV vence | ✅ `tui.json` válido e sem `theme` (v1.3.0); `keybinds` e `attention` preservados |
| T4 | Verificação integrada | R1+R2+R3 | ✅ Contagem 33, schema, teste de unidade; ⏳ restart + toggle `A` no tmux (manual) |

---

## 5. Verificação

```bash
# Sintaxe do plugin
node --check ~/.config/opencode/plugins/theme-opacity-sync.js

# Todos os temas gêmeos são JSON válido
for f in ~/.config/opencode/themes/*-transparent.json; do
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$f" || echo "INVÁLIDO: $f"
done

# Contagem: 33 gêmeos
ls ~/.config/opencode/themes/*-transparent.json | wc -l

# Todos os 9 campos de fundo = "none" (incl. backgroundMenu, intencional)
node -e "const fs=require('fs');const p='/home/albano/.config/opencode/themes';
const F=['background','backgroundPanel','backgroundElement','backgroundMenu','diffAddedBg','diffRemovedBg','diffContextBg','diffAddedLineNumberBg','diffRemovedLineNumberBg'];
for(const f of fs.readdirSync(p).filter(f=>f.endsWith('-transparent.json'))){const t=JSON.parse(fs.readFileSync(p+'/'+f,'utf8'));for(const k of F){if(t.theme[k]!=='none')process.exit(1)}}console.log('OK: fundos none em todos')"
```

Depois: **reiniciar o opencode** (temas e plugin carregam no start), conferir a lista de
temas no `/theme` (33 gêmeos presentes) e testar o toggle `A` no tmux com opacidade 0.8.
Comportamento esperado (v2): escolher qualquer tema via `/theme` **mantém** a escolha; o
toggle `A` é o que alterna entre o tema de base e seu gêmeo transparente.

**Persistência (v1.3.0):** como `tui.json` não pina `theme`, a escolha do usuário (manual ou
do plugin) é gravada no KV e reaplicada após `/exit` + restart. Teste manual: escolher um
tema no `/theme`, executar `/exit`, abrir o opencode de novo → o tema escolhido deve estar
ativo.

---

## 6. Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Escolha manual de tema sobrescrita pelo auto-sync | — | — | **Corrigido na v2:** tema atual não setado pelo plugin vira base e não é forçado; sync só em transição do estado do terminal |
| Alacritty não tem state file (toggle via IPC/socket) → plugin não reage | Alta | Médio | Follow-up opcional não aprovado: estender toggle para gravar state file do alacritty |
| Restart obrigatório para carregar temas e plugin | Certa | Baixo | Documentado; config não é hot-reload |
| tmux com `window-style` `bg=` explícito bloqueia transparência | Baixa | Médio | Config atual usa `bg=default`/`terminal` — OK |
| Drift de versão: temas do branch `dev` vs. opencode 1.18.27 instalado | Média | Baixo | Verificar nomes no `/theme` após restart; gerador idempotente facilita regenerar |
| Manutenção: 33 arquivos para regenerar quando o opencode atualizar temas | Média | Baixo | Gerador `sync-transparent-themes.mjs` versionado e re-executável |
| Polling 1s do plugin (custo CPU mínimo) | Baixa | Baixo | Intervalo configurável; aceitável |

---

## 7. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.3.0** | 2026-09-06 | IMPLEMENTED | Correção de persistência: remover `"theme": "opencode"` do `tui.json`. Causa raiz: no start o TUI resolve `config.theme ?? kv.get("theme")` — com `theme` no config, a escolha persistida no KV (manual ou do plugin) era sempre ignorada no restart. |
| **1.2.0** | 2026-09-06 | IMPLEMENTED | Correção do auto-sync (v2): a escolha manual via `/theme` sempre vence; sync só em transição do estado do terminal (`nextAction` puro + máquina de estados `{terminal, base, lastSet}`); sem força no 1º poll (elimina piscada no start); teste ampliado para 18/18 cenários. |
| **1.1.0** | 2026-09-06 | IMPLEMENTED | Implementação T1–T4 pelo build-auto: 33 gêmeos gerados, plugin + teste de unidade (9/9), `tui.json` editado. Correção: `backgroundMenu` incluído nos campos transformados (suportado pelo TUI, schema web desatualizado). |
| **1.0.0** | 2026-09-06 | INITIAL | Refinamento do plano da sessão `ses_f8b79af30ffemE3825rc3hqgIj`: duplicar **todos** os 33 temas embutidos com variantes transparentes + plugin de sincronização generalizado. |

---

## 8. Referências

- [Documentação oficial — Themes](https://opencode.ai/docs/themes/)
- [Schema de tema](https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/web/public/theme.json)
- [Spec TUI plugins](https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/specs/tui-plugins.md)
- [Temas embutidos (assets)](https://github.com/anomalyco/opencode/tree/dev/packages/tui/src/theme/assets)
- Plano original da sessão: `/home/albano/projects/Go/cmdsh/docs/plan/opencode-terminal-opacity.md`
- ADR relacionado: [`docs/adr/0004-opencode-terminal-opacity.md`](file:///home/albano/.config/opencode/docs/adr/0004-opencode-terminal-opacity.md)