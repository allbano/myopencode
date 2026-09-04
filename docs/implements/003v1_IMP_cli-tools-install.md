# 003v1_IMP_cli-tools-install.md — Instalação dos CLIs de Observabilidade no PATH

> **Data:** 2026-08-31  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Implementação (IMP)  
> **Versão:** 1.0  
> **Status:** Documentação de uso  
> **Relacionado:** `002v1_IMP_agent-runtime-observability.md`

---

## 1. Objetivo

Tornar `trace-search.mjs` e `observe-tail.sh` disponíveis globalmente como `opencode-trace` e `opencode-observe`, sem depender do caminho original em `~/.config/opencode/tools/`.

---

## 2. Pré-requisitos

- `~/.local/bin` no `$PATH` (adicionar ao `.bashrc`/`.zshrc` se não estiver):
  ```bash
  export PATH="$HOME/.local/bin:$PATH"
  ```
- `jq` instalado (para saída formatada do `observe-tail.sh`):
  ```bash
  sudo apt install jq      # Debian/Ubuntu
  brew install jq          # macOS
  ```

---

## 3. Instalação — `opencode-trace` (busca histórica)

```bash
# 1. Copiar para ~/.local/bin
cp ~/.config/opencode/tools/trace-search.mjs ~/.local/bin/opencode-trace

# 2. Adicionar shebang (primeira linha do arquivo)
#    Edite ~/.local/bin/opencode-trace e garanta que a primeira linha seja:
#    #!/usr/bin/env node

# 3. Tornar executável
chmod +x ~/.local/bin/opencode-trace

# 4. Testar
opencode-trace --help
opencode-trace --agent build-auto --today
opencode-trace --session ses_abc --stats
```

> **Nota:** o script usa `homedir()` → resolve `~/.config/opencode/traces` automaticamente. Funciona de qualquer diretório.

---

## 4. Instalação — `opencode-observe` (live tail)

```bash
# 1. Copiar
cp ~/.config/opencode/tools/observe-tail.sh ~/.local/bin/opencode-observe

# 2. Já tem shebang `#!/usr/bin/env bash` — só tornar executável
chmod +x ~/.local/bin/opencode-observe

# 3. Testar (em 2º terminal/tmux split)
opencode-observe              # segue a sessão ativa mais recente
opencode-observe --all        # merge de todas as sessões de hoje
```

> Requer `jq` para saída colorida/emoji. Sem `jq`, cai em `tail -f` puro.

---

## 5. Variáveis de Ambiente Opcionais

| Variável | Efeito |
|----------|--------|
| `OPENCODE_TRACES_DIR` | Sobrescreve base dos traces (padrão: `~/.config/opencode/traces`) |
| `OPENCODE_OBSERVE=off` | Desliga o plugin completamente |
| `OPENCODE_OBSERVE_TOASTS=off` | Desliga só toasts |

Exemplo para testar com traces isolados:
```bash
OPENCODE_TRACES_DIR=/tmp/meus-traces opencode-trace --today
```

---

## 6. Atualização Futura

Quando o plugin `agent-observer.js` for atualizado, as CLIs **não precisam ser recopiadas** — elas leem os arquivos de trace gerados, não o código do plugin. Só recopie se houver mudança na interface (ex.: novo campo no JSONL, nova flag).

---

## 7. Verificação Rápida

```bash
# Ambos no PATH?
which opencode-trace opencode-observe

# Help funciona?
opencode-trace --help
opencode-observe --help
```

---

*Documento de instalação. Para o sistema completo, veja `002v1_IMP_agent-runtime-observability.md`.*