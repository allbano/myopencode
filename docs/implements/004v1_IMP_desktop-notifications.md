# 004v1_IMP_desktop-notifications.md — Implementação de Notificações Desktop e Limpeza da TUI

> **Data:** 2026-09-04  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Implementação (IMP)  
> **Versão:** 1.0  
> **Status:** Concluído  
> **Relacionado:** `docs/adr/003v1_ADR_desktop-notifications_explains.md`, `docs/implements/002v1_IMP_agent-runtime-observability.md`, `docs/implements/003v1_IMP_cli-tools-install.md`

---

## 1. Escopo

Implementar a decisão arquitetural documentada em `docs/adr/003v1_ADR_desktop-notifications_explains.md`:
1. Redirecionar as notificações de eventos (subagentes concluídos, permissões e erros de sessão) para o sistema de notificações nativo do Linux (Desktop) via `notify-send`.
2. Desativar os balões intrusivos (toasts) na interface do terminal (TUI) por padrão, tornando-os estritamente opt-in via `OPENCODE_OBSERVE_TOASTS=on`.
3. Registrar a alteração efetuada pelo usuário em `tui.json` (`"notifications": false`), mantendo sons e atualizações do OpenCode.
4. Fornecer testes de fumaça e documentação integral com cadeia de comandos executados.

---

## 2. Arquivos Criados/Modificados

| Arquivo | Ação | Descrição |
|---|---|---|
| `plugins/agent-observer.js` | **Editado** | Adicionado módulo `spawn`, função `notifyDesktop` via `notify-send`, e invertido padrão de toasts para opt-in |
| `tools/.smoke/smoke.mjs` | **Editado** | Habilitado `OPENCODE_OBSERVE_TOASTS="on"` na suite de fumaça para validar integração contínua do `showToast` |
| `tui.json` | **Editado (usuário)** | `"notifications": false` em `attention` (desativa sequências OSC do terminal e preserva sons) |
| `docs/adr/003v1_ADR_desktop-notifications_explains.md` | **Criado** | Registro de decisão arquitetural (ADR) sobre a separação dos canais de notificação |
| `docs/implements/004v1_IMP_desktop-notifications.md` | **Criado** | Este documento de implementação com histórico, evidências e diffs |

---

## 3. O que foi desativado no `tui.json`

O usuário alterou no arquivo `tui.json`:

```json
  "attention": {
    "enabled": true,
    "notifications": false,
    "sound": true,
    "volume": 0.4
  }
```

### Diagnóstico Técnico da Alteração:
- **O que `notifications: false` desativa:**
  O binário do OpenCode para de emitir sequências de escape OSC (como OSC 777 / OSC 9) para o emulador de terminal. Isso evita notificações redundantes do terminal que dependem de suporte do emulador (Ghostty, Kitty, WezTerm).
- **O que `notifications: false` NÃO desativa:**
  Não desativava os toasts desenhados na tela do terminal via plugin (`client.tui.showToast`), motivo pelo qual a intervenção no código do plugin foi necessária.
- **O que permanece ativo:**
  `"sound": true` preserva o sintetizador de áudio nativo do OpenCode (`subagent_done`, `permission`, `error`).
  `"autoupdate": "notify"` no `opencode.jsonc` preserva avisos de atualização da ferramenta.

---

## 4. Detalhamento das Alterações de Código

### 4.1 `plugins/agent-observer.js`

1. **Imports:**
   Adicionado `spawn` de `node:child_process`.
2. **Flags Dinâmicas:**
   Substituída a constante estática por funções avaliadas em tempo de execução:
   ```javascript
   const isToastsEnabled = () => process.env.OPENCODE_OBSERVE_TOASTS === "on"
   const isDesktopEnabled = () => process.env.OPENCODE_OBSERVE_DESKTOP !== "off"
   ```
3. **Função `notifyDesktop`:**
   Invocação desacoplada e não-bloqueante de `/usr/sbin/notify-send`:
   ```javascript
   function notifyDesktop(title, message, variant = "info") {
     if (!isDesktopEnabled()) return
     try {
       const urgencyMap = {
         error: "critical",
         warning: "normal",
         info: "low",
         success: "normal",
       }
       const iconMap = {
         error: "dialog-error",
         warning: "dialog-warning",
         info: "dialog-information",
         success: "dialog-information",
       }
       const urgency = urgencyMap[variant] || "normal"
       const icon = iconMap[variant] || "dialog-information"
       const child = spawn(
         "notify-send",
         ["-a", "OpenCode", "-u", urgency, "-i", icon, String(title), String(message)],
         {
           detached: true,
           stdio: "ignore",
         }
       )
       child.on("error", () => {})
       child.unref()
     } catch {
       // Silencioso se notify-send falhar ou ambiente headless
     }
   }
   ```
4. **Função `toast`:**
   Despacha para `notifyDesktop` e encerra se `isToastsEnabled()` for falso:
   ```javascript
   async function toast(client, title, message, variant = "info", duration = 5000) {
     // 1. Notificação nativa do sistema operacional (Desktop)
     notifyDesktop(title, message, variant)

     // 2. Toast na tela do TUI (desativado por padrão para evitar poluição visual)
     if (!isToastsEnabled()) return
     try {
       await client.tui.showToast({ body: { title, message, variant, duration } })
     } catch {
       // TUI pode não estar conectada (modo headless/CLI)
     }
   }
   ```

---

## 5. Cadeia de Comandos Executados

### Passo 1 — Diagnóstico de executáveis do sistema
```bash
$ which notify-send
/usr/sbin/notify-send

$ notify-send --help
Uso:
  notify-send [OPÇÃO…] <SUMMARY> [BODY] - create a notification
...
```

### Passo 2 — Teste real de emissão desktop
```bash
$ notify-send -a "OpenCode" -u low -i dialog-information "OpenCode Test" "Teste de notificacao"
# Retorno: 0 (notificação emitida com sucesso no ambiente gráfico)
```

### Passo 3 — Validação de sintaxe após refatoração
```bash
$ node --check plugins/agent-observer.js
# Retorno: 0 (sintaxe válida)
```

### Passo 4 — Execução da suíte de teste de fumaça
```bash
$ node tools/.smoke/smoke.mjs
PASS  jsonl existe
PASS  trace.json existe
PASS  trace.md existe
PASS  jsonl tem >= 8 eventos
PASS  subagent.begin presente
PASS  subagent.end com duração
PASS  permission.asked presente
PASS  model.usage presente
PASS  todo.update presente
PASS  trace.md menciona subagente
PASS  trace.md tem Timeline
PASS  toast disparado (>=1: subagente+permissão)

SMOKE OK — todos os artefatos gerados corretamente
```

### Passo 5 — Validação das ferramentas auxiliares
```bash
$ node --check tools/trace-search.mjs && bash -n tools/observe-tail.sh
# Retorno: 0 (sem erros de sintaxe)
```

---

## 6. Diffs Relevantes

### 6.1 `plugins/agent-observer.js`
```diff
--- i/plugins/agent-observer.js
+++ w/plugins/agent-observer.js
@@ -7,15 +7,19 @@
 //   traces/metrics/agents.json | models.json — agregados
 //
 // Desligar: OPENCODE_OBSERVE=off
-// Sem toasts: OPENCODE_OBSERVE_TOASTS=off
+// Desligar tudo: OPENCODE_OBSERVE=off
+// Toasts no TUI: OPENCODE_OBSERVE_TOASTS=on (padrão: off para evitar poluição visual no terminal)
+// Notificações desktop: OPENCODE_OBSERVE_DESKTOP=off (padrão: on via notify-send)
 
+import { spawn } from "node:child_process"
 import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
 import { existsSync } from "node:fs"
 import { homedir } from "node:os"
 import { join } from "node:path"
 
 const ENABLED = process.env.OPENCODE_OBSERVE !== "off"
-const TOASTS = process.env.OPENCODE_OBSERVE_TOASTS !== "off"
+const isToastsEnabled = () => process.env.OPENCODE_OBSERVE_TOASTS === "on"
+const isDesktopEnabled = () => process.env.OPENCODE_OBSERVE_DESKTOP !== "off"
 
 const BASE = join(homedir(), ".config", "opencode", "traces")
 const PREVIEW_LIMIT = 2000 // chars de payload no JSONL
@@ -259,10 +263,46 @@
   }
 }
 
-// ---------- toasts ----------
+// ---------- notificações e toasts ----------
+
+function notifyDesktop(title, message, variant = "info") {
+  if (!isDesktopEnabled()) return
+  try {
+    const urgencyMap = {
+      error: "critical",
+      warning: "normal",
+      info: "low",
+      success: "normal",
+    }
+    const iconMap = {
+      error: "dialog-error",
+      warning: "dialog-warning",
+      info: "dialog-information",
+      success: "dialog-information",
+    }
+    const urgency = urgencyMap[variant] || "normal"
+    const icon = iconMap[variant] || "dialog-information"
+    const child = spawn(
+      "notify-send",
+      ["-a", "OpenCode", "-u", urgency, "-i", icon, String(title), String(message)],
+      {
+        detached: true,
+        stdio: "ignore",
+      }
+    )
+    child.on("error", () => {})
+    child.unref()
+  } catch {
+    // Silencioso se notify-send falhar ou ambiente headless
+  }
+}
 
 async function toast(client, title, message, variant = "info", duration = 5000) {
-  if (!TOASTS) return
+  // 1. Notificação nativa do sistema operacional (Desktop)
+  notifyDesktop(title, message, variant)
+
+  // 2. Toast na tela do TUI (desativado por padrão para evitar poluição visual)
+  if (!isToastsEnabled()) return
   try {
     await client.tui.showToast({ body: { title, message, variant, duration } })
   } catch {
```

### 6.2 `tui.json`
```diff
--- i/tui.json
+++ w/tui.json
@@ -12,7 +12,7 @@
   },
   "attention": {
     "enabled": true,
-    "notifications": true,
+    "notifications": false,
     "sound": true,
     "volume": 0.4
   }
```

---

## 7. Verificação de Funcionamento

1. Ao executar tarefas com subagentes, pedidos de permissão ou erros de sessão:
   - A interface do OpenCode permanece limpa, sem mensagens pop-up ou caixas temporizadas bloqueando o texto.
   - O áudio de alerta continua soando pelo sintetizador nativo do OpenCode (`sound: true`).
   - O ambiente desktop Linux exibe balão nativo via `notify-send`, com categoria, ícone e urgência correspondentes, permitindo fechar ou revisar no painel de notificações do sistema.
