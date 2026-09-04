#!/usr/bin/env bash
# observe-tail.sh — acompanha ao vivo a atividade dos agentes a partir dos traces JSONL
#
# Uso:
#   observe-tail.sh            # segue o JSONL da sessão ativa mais recente
#   observe-tail.sh --all      # faz merge de todos os JSONL de hoje
#
# Requer: jq (para formatação). Sem jq, cai em tail -f puro.

set -euo pipefail

TRACES_DIR="${OPENCODE_TRACES_DIR:-$HOME/.config/opencode/traces}"
TODAY="$(date +%F)"
MODE="${1:-latest}"

if [[ ! -d "$TRACES_DIR/$TODAY" ]]; then
  echo "Nenhum trace de hoje ($TODAY) em $TRACES_DIR/$TODAY" >&2
  echo "Inicie uma sessão do opencode e tente novamente." >&2
  exit 1
fi

latest_jsonl() {
  find "$TRACES_DIR/$TODAY" -maxdepth 1 -name '*.jsonl' -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -n1 | cut -d' ' -f2-
}

format_jq='
def t: .ts[11:19];
def dur: if .duration_ms then " (\(.duration_ms)ms)" else "" end;
"t=\(.ts[11:19]) [\(.agent // "?")] " + (
  if    .event == "tool.begin"         then "▶ \(.tool) \(.target // "")"
  elif  .event == "tool.end"           then "◀ \(.tool)\(dur) \(if .ok then "" else "❌" end)"
  elif  .event == "subagent.begin"     then "🚀 subagente \(.subagent): \(.description // .prompt // "")"
  elif  .event == "subagent.end"       then "✅ subagente \(.subagent)\(dur) \(if .ok then "" else "❌" end)"
  elif  .event == "permission.asked"   then "🔐 permissão: \(.permission) \(.patterns // "")"
  elif  .event == "permission.replied" then "🔐 resposta: \(.reply)"
  elif  .event == "todo.update"        then "📋 todos atualizados (\(.count) itens)"
  elif  .event == "model.usage"        then "🤖 \(.model // "?") +\(.input // 0)in/+\(.output // 0)out"
  elif  .event == "session.start"      then "── sessão iniciada \(.session_id)"
  elif  .event == "session.idle"       then "── sessão idle"
  elif  .event == "session.error"      then "⛔ erro: \(.error // "?")"
  elif  .event == "session.compacted"  then "📦 compactada"
  elif  .event == "command.executed"   then "⌨️  /\(.command // "?")"
  else "· \(.event)" end)
'

case "$MODE" in
  --all)
    if command -v jq >/dev/null 2>&1; then
      find "$TRACES_DIR/$TODAY" -maxdepth 1 -name '*.jsonl' -print0 \
        | xargs -0 tail -n +1 -f 2>/dev/null | jq -r --unbuffered "$format_jq"
    else
      find "$TRACES_DIR/$TODAY" -maxdepth 1 -name '*.jsonl' -print0 | xargs -0 tail -f
    fi
    ;;
  *)
    FILE="$(latest_jsonl)"
    echo "Seguindo: $FILE (Ctrl+C para sair)" >&2
    if command -v jq >/dev/null 2>&1; then
      tail -n +1 -f "$FILE" | jq -r --unbuffered "$format_jq"
    else
      tail -n +1 -f "$FILE"
    fi
    ;;
esac
