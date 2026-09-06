---
title: "Temas gêmeos transparentes para todos os temas do opencode"
slug: "opencode-terminal-opacity"
version: 1.0.0
status: "accepted"
last_reviewed: 2026-09-06
owners:
  - "@albano"
---

# ADR 0004: Temas gêmeos transparentes para todos os temas do opencode

> **Tipo:** Architecture Decision Record (ADR)
> **Status:** Aceito
> **Relacionado:** [`.opencode/plans/opencode-terminal-opacity.md`](file:///home/albano/.config/opencode/.opencode/plans/opencode-terminal-opacity.md)

---

## 1. Contexto

O opencode pinta fundos opacos em todos os temas embutidos. O terminal só aplica
`background_opacity` onde o aplicativo não pinta fundo, então a transparência do terminal
nunca aparece no opencode. O usuário alterna a opacidade via `toggle-terminal-transparency`
(keybind `A` no tmux), que grava state files em
`~/.local/state/dotfiles/terminal-transparency/{ghostty,kitty}.conf`.

A sessão `ses_f8b79af30ffemE3825rc3hqgIj` (2026-09-06) aprovou a abordagem de tema gêmeo +
plugin TUI para o tema `opencode`. O usuário estendeu o pedido para **todos os 33 temas
embutidos**.

## 2. Decisão

### 2.1 Temas gêmeos transparentes

Para cada um dos 33 temas embutidos, criar `~/.config/opencode/themes/<nome>-transparent.json`:
cópia exata do tema original com os 9 campos de fundo (`background`, `backgroundPanel`,
`backgroundElement`, `backgroundMenu`, `diffAddedBg`, `diffRemovedBg`, `diffContextBg`,
`diffAddedLineNumberBg`, `diffRemovedLineNumberBg`) definidos como `"none"` (usa o fundo do
terminal, permitindo a opacidade). Demais campos e `defs` permanecem idênticos.

- `"none"` é um `colorValue` válido no schema do tema; o resolver do TUI trata `"none"` e
  `"transparent"` como equivalentes (`RGBA(0,0,0,0)`).
- `backgroundMenu` **é** suportado pelo TUI (`Theme.backgroundMenu` em
  `packages/tui/src/theme/index.ts`), com fallback para `backgroundElement` quando ausente.
  O schema web (`packages/web/public/theme.json`) está desatualizado e não o lista — por
  isso foi incluído explicitamente nos gêmeos (sem ele, `lucent-orng` manteria menus
  semi-opacos `#2a1a1599`).
- O tema `system` não recebe gêmeo (é gerado em runtime e já usa fundo transparente).

### 2.2 Plugin TUI `theme-opacity-sync.js`

Plugin de arquivo (`export default { id: "theme-opacity-sync", tui }`) que:

1. Lê os state files do toggle e detecta opacidade `< 1.0` (terminal transparente).
2. Se transparente e o tema atual tem gêmeo `<atual>-transparent`, troca para o gêmeo.
3. Se opaco e o tema atual é um gêmeo (`-transparent`), volta para o original.
4. Respeita a escolha manual de tema via `/theme` (só alterna entre pares conhecidos).
5. Polling a cada 1s; `api.lifecycle.onDispose` limpa o timer.

### 2.3 Configuração

`~/.config/opencode/tui.json` ganha `"theme": "opencode"` e
`"plugin": ["./plugins/theme-opacity-sync.js"]`.

### 2.4 Gerador

`~/.config/opencode/tools/sync-transparent-themes.mjs` gera/regenera os 33 gêmeos a partir
do branch `dev` do repositório do opencode (idempotente, para manutenção futura).

## 3. Alternativas Consideradas

| Alternativa | Motivo da rejeição |
|-------------|--------------------|
| Plugin instala tema transparente em runtime via `api.theme.install` | Mais complexo e frágil; gêmeos em arquivo são declarativos, versionáveis e inspecionáveis |
| Editar o tema `opencode` original para fundos `"none"` | Perde o tema opaco; usuário quer preservar a aparência original quando o terminal está opaco |
| Só o tema `opencode` (escopo original da sessão) | Usuário pediu explicitamente todos os temas |
| Hook do toggle (em vez de polling) | Toggle roda fora do opencode (tmux); sem canal de notificação confiável; polling de 1s é simples e barato |

## 4. Consequências

**Positivas:**
- Qualquer tema selecionado via `/theme` continua funcionando com transparência.
- Solução declarativa e versionável (33 JSON + 1 plugin + 1 config).
- Gerador idempotente facilita regenerar quando o opencode atualizar temas.

**Negativas / Riscos:**
- Restart do opencode necessário para carregar temas e plugin.
- KV persiste o tema selecionado → possível piscada de tema errado ~1s no start (plugin corrige).
- Alacritty não tem state file → plugin não reage nesse terminal (follow-up opcional).
- Drift de versão entre branch `dev` e a versão instalada (1.18.27) — verificar nomes no `/theme`.

## 5. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.1.0** | 2026-09-06 | UPDATED | Implementação concluída (build-auto). Correção: `backgroundMenu` incluído nos 9 campos transformados — suportado pelo TUI (`packages/tui/src/theme/index.ts`), schema web desatualizado. |
| **1.0.0** | 2026-09-06 | INITIAL | Decisão de duplicar todos os 33 temas embutidos com variantes transparentes + plugin de sincronização generalizado. |

## 6. Referências

- [Schema de tema](https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/web/public/theme.json)
- [Spec TUI plugins](https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/specs/tui-plugins.md)
- Plano: [`.opencode/plans/opencode-terminal-opacity.md`](file:///home/albano/.config/opencode/.opencode/plans/opencode-terminal-opacity.md)
- Plano original da sessão: `/home/albano/projects/Go/cmdsh/docs/plan/opencode-terminal-opacity.md`