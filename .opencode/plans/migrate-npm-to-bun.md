# Plano: migrar o repositório para bun como único package manager

Status: aguardando aprovação
Data: 2026-09-08

## Objetivo

Remover totalmente o npm do repositório `~/.config/opencode` e usar apenas bun
como package manager. Não tocar no mise (node/bun do sistema ficam como estão).

## Contexto

- O opencode embute bun e roda `bun install` no startup para deps do config dir.
- `package-lock.json` (npm) está tracked; `bun.lock` (bun) está untracked.
- `build/config.gypi` (artefato node-gyp) já foi deletado manualmente.
- 2 tools têm shebang `#!/usr/bin/env node`; 10 scripts em `vendor/agent-skills`
  também, mas esses NÃO devem ser alterados (submodule do upstream).

## Tarefas

1. **`.gitignore`** — adicionar `build/`; atualizar comentário de
   "npm install" para "bun install".
2. **Remover lockfile npm** — `git rm package-lock.json`.
3. **Versionar lockfile bun** — `git add bun.lock`.
4. **Trocar shebangs** — `tools/trace-search.mjs` e
   `tools/sync-transparent-themes.mjs`: `#!/usr/bin/env node` →
   `#!/usr/bin/env bun`. Atualizar comentários de uso (`node ...` → `bun ...`).
   NÃO tocar em `vendor/agent-skills/scripts/*.js`.
5. **Testes de execução com bun** (verificar erros de runtime):
   - `bun tools/test-theme-opacity-sync.mjs` — teste de unidade do plugin
     (núcleo puro `nextAction`), deve passar.
   - `bun tools/trace-search.mjs --help` — deve imprimir uso e sair 0.
   - `bun tools/trace-search.mjs --today --limit 5` — deve listar traces
     (ou sair 1 com "Nenhum trace" se não houver dados do dia).
   - `bun tools/sync-transparent-themes.mjs` — regenera temas gêmeos
     (idempotente; requer rede). Validar que gera `33/33` ou reporta erros.
   - Comparar saída de `bun` vs `node` para os mesmos comandos (paridade).
6. **Regenerar node_modules com bun** — `rm -rf node_modules && bun install`
   (garante árvore criada por bun; `bun.lock` é atualizado).
7. **Verificação final** — `git status` deve mostrar:
   - `package.json` (modificado, mantido)
   - `bun.lock` (novo)
   - `package-lock.json` (removido)
   - `tools/*.mjs` (shebang trocado)
   - `.gitignore` (build/ adicionado)
8. **Commit** — `chore: migrar gerenciador de pacotes de npm para bun`
   (após revisão do usuário).

## Fora do escopo

- node/bun do mise (intocados).
- `vendor/agent-skills/scripts/*.js` (submodule; shebangs node permanecem).
- `.opencode/package.json` (já gerenciado pelo bun embutido do opencode).

## Riscos

- `bun install` pode resolver versões ligeiramente diferentes → diff maior no
  `bun.lock` (não quebra nada).
- `sync-transparent-themes.mjs` depende de rede (fetch dos temas do GitHub);
  se offline, reporta erros por tema mas não corrompe nada.
- Troca de shebang pode falhar se o opencode invocar tools com `node` explícito
  em vez do shebang — mitigado pelo teste de paridade (passo 5).

## Evidências

- Saída dos testes do passo 5 (bun vs node).
- `git status` final (passo 7).