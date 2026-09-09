# Patch do Rodape de Contexto do OpenCode 1.18.29

Este guia aplica o patch `opencode-v1.18.29-context-window-footer.patch` ao codigo-fonte do OpenCode, gera uma build customizada e a registra no `mise` sem sobrescrever a instalacao oficial.

## Resultado esperado

- O path da sessao permanece no lado esquerdo da linha inferior.
- O lado direito mostra a capacidade total da janela de contexto do modelo atualmente selecionado e o percentual utilizado.
- A quantidade de tokens consumidos e o custo deixam de aparecer nessa linha.
- Antes da primeira resposta do modelo, os atalhos nativos continuam visiveis.

Exemplo:

```text
/workspace/projeto                                      200.0K (34%)
```

## Pre-requisitos

- OpenCode `1.18.29`.
- Git, Bun e mise instalados.
- Patch existente em `~/.config/opencode/patches/opencode-v1.18.29-context-window-footer.patch`.

## 1. Obter o codigo-fonte

Use um diretorio persistente, pois conteudo em `/tmp` pode ser removido:

```bash
mkdir -p "$HOME/.local/src"

git clone --depth 1 --branch v1.18.29 \
  https://github.com/anomalyco/opencode.git \
  "$HOME/.local/src/opencode-1.18.29-context-footer"

cd "$HOME/.local/src/opencode-1.18.29-context-footer"
```

## 2. Aplicar o patch

Valide antes de modificar o checkout:

```bash
git apply --check \
  "$HOME/.config/opencode/patches/opencode-v1.18.29-context-window-footer.patch"
```

Depois aplique:

```bash
git apply \
  "$HOME/.config/opencode/patches/opencode-v1.18.29-context-window-footer.patch"

git diff --check
git diff -- packages/tui/src/component/prompt/index.tsx
```

## 3. Instalar dependencias e validar

```bash
bun install --frozen-lockfile

cd packages/tui
bun typecheck
bun test
cd ../..
```

Na validacao original do patch, o resultado foi:

```text
Typecheck: passou
Testes TUI: 193 passaram, 1 ignorado, 0 falharam
```

Os testes podem emitir avisos nao fatais sobre a ausencia de `/tmp/opencode/state/kv.json`.

## 4. Gerar o binario

```bash
OPENCODE_VERSION='1.18.29+context-footer' \
  ./packages/opencode/script/build.ts --single
```

No Linux x64, o binario sera criado em:

```text
packages/opencode/dist/opencode-linux-x64/bin/opencode
```

Confirme a build antes da instalacao:

```bash
packages/opencode/dist/opencode-linux-x64/bin/opencode --version
```

## 5. Registrar a build no mise

Crie uma instalacao separada, preservando o OpenCode oficial:

```bash
mkdir -p "$HOME/.local/opt/opencode-context-footer"

install -m 755 \
  "packages/opencode/dist/opencode-linux-x64/bin/opencode" \
  "$HOME/.local/opt/opencode-context-footer/opencode"

mise link opencode@context-footer \
  "$HOME/.local/opt/opencode-context-footer"

mise exec opencode@context-footer -- opencode --version
mise use --global opencode@context-footer
```

Se o link `opencode@context-footer` ja existir, atualize-o com:

```bash
mise link --force opencode@context-footer \
  "$HOME/.local/opt/opencode-context-footer"
```

## 6. Ativar e verificar

Encerre completamente o OpenCode atual e abra um novo terminal. A configuracao selecionada pelo `mise` entra em vigor no proximo prompt do shell.

```bash
mise current opencode
opencode --version
opencode
```

A informacao de contexto aparece depois que houver uma resposta concluida do modelo.

## Rollback

Retorne ao binario oficial sem apagar a build customizada:

```bash
mise use --global opencode@1.18.29
```

Abra um novo terminal e confirme:

```bash
mise current opencode
opencode --version
```

## Atualizacoes futuras

O patch e especifico para o OpenCode `1.18.29`. Antes de atualizar para outra versao:

1. Obtenha o codigo-fonte da nova tag.
2. Execute `git apply --check` com o patch atual.
3. Revise o componente `packages/tui/src/component/prompt/index.tsx` se a validacao falhar.
4. Rode novamente typecheck, testes e build.
5. Nao substitua a instalacao customizada ate todas as verificacoes passarem.
