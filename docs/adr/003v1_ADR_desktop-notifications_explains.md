# 003v1_ADR_desktop-notifications_explains.md — ADR: Notificações Desktop Nativas (Linux) e Limpeza Visual da TUI

> **Data:** 2026-09-04  
> **Autor:** OpenCode (assistente)  
> **Tipo:** Architecture Decision Record (ADR)  
> **Versão:** 1.0  
> **Status:** Aceito  
> **Relacionado:** `002v1_ADR_agent-runtime-observability_explains.md`, `002v1_IMP_agent-runtime-observability.md`, `004v1_IMP_desktop-notifications.md`

---

## 1. Contexto e Problema

Na implementação do sistema de observabilidade (`002v1_ADR_agent-runtime-observability_explains.md`), foram introduzidos toasts na interface TUI via `client.tui.showToast` para sinalizar eventos críticos: conclusão de subagentes, pedidos de permissão e erros de sessão.

Na utilização prática, o usuário identificou problemas de usabilidade:
1. **Poluição visual da TUI:** os balões de toast ocupavam a área do terminal onde o código e as saídas das ferramentas estão sendo lidos.
2. **Ausência de dismiss:** os toasts do OpenCode não fornecem mecanismo para fechar a mensagem antes do tempo limite estipulado (`duration` entre 5 e 10 segundos).
3. **Confusão de controle de configuração:** o usuário tentou desativar as mensagens da TUI configurando `"notifications": false` no arquivo `tui.json`. No entanto, o `tui.json` gerencia exclusivamente as sequências de escape do emulador de terminal nativas do binário (`attention`), sem interferir nas chamadas de plugin via SDK (`showToast`).

**Requisitos declarados pelo usuário:**
- Manter alertas sonoros do OpenCode (`sound: true` no `tui.json`).
- Manter notificações de atualização do OpenCode (`autoupdate: notify` no `opencode.jsonc`).
- **Eliminar** qualquer mensagem intrusiva/toast na tela da TUI.
- **Redirecionar** os alertas de eventos importantes (conclusão de subagentes, permissões e erros) para as notificações nativas do sistema operacional (Desktop Linux).

---

## 2. Decisão 1 — Separação Estrita dos Canais de Notificação

Fica estabelecida a separação dos canais de feedback do OpenCode:

| Canal | Responsável | Mecanismo | Estado |
|---|---|---|---|
| **Áudio / Sons de Atenção** | Nativo do OpenCode (`tui.json`) | `attention.sound: true` | **Ativo** |
| **Alertas de Atualização de Versão** | Nativo do OpenCode (`opencode.jsonc`) | `autoupdate: notify` | **Ativo** |
| **Notificações de Eventos (Desktop)** | Plugin `agent-observer.js` | `notify-send` (Linux DBus/Desktop) | **Ativo (Padrão)** |
| **Toasts na Tela do Terminal (TUI)** | Plugin `agent-observer.js` | `client.tui.showToast` | **Desativado (Opt-in)** |

---

## 3. Decisão 2 — Despacho Desktop Desacoplado via `notify-send`

**Decisão:** o plugin [`plugins/agent-observer.js`](file:///home/albano/.config/opencode/plugins/agent-observer.js) passa a emitir notificações diretamente ao daemon de notificações do Linux (GNOME Notification Center, Dunst, Mako, KDE Plasma, etc.) via invocação não-bloqueante de `/usr/sbin/notify-send`.

**Por quê:**
- **Zero dependências externas:** utiliza utilitário padrão do ecossistema Linux desktop (`libnotify-bin` / `notify-send`) e módulo embutido `node:child_process`.
- **Controle do usuário:** notificações de desktop podem ser descartadas imediatamente com clique, dispensadas com atalho do gerenciador de janelas ou consultadas no histórico de notificações do sistema.
- **Não bloqueante:** executado via `spawn` com `detached: true`, `stdio: "ignore"` e `unref()`, garantindo que o ciclo de eventos do OpenCode nunca sofra atraso mesmo se o servidor DBus estiver ocupado.
- **Resiliente:** tratamento defensivo com listener de erro (`child.on("error", () => {})`) e bloco `try/catch` para garantir que ambientes headless ou sessões SSH sem display continuem funcionando silenciosamente.

**Parâmetros de despacho:**
- Nome do aplicativo (`-a OpenCode`): permite agrupamento e filtragem pelo gerenciador de notificações.
- Urgência mapeada:
  - Erro de sessão → `critical` com ícone `dialog-error`.
  - Permissão solicitada → `normal` com ícone `dialog-warning`.
  - Subagente concluído → `low` (ou `normal` se falhar) com ícone `dialog-information`.

---

## 4. Decisão 3 — Inversão do Padrão de Toasts na TUI (Opt-in)

**Decisão:** os toasts na interface do terminal passam a ser **desativados por padrão**.
A exibição de mensagens na tela do terminal torna-se estritamente *opt-in*, ativada apenas se a variável de ambiente for configurada explicitamente como `OPENCODE_OBSERVE_TOASTS=on`.

**Configuração das variáveis de ambiente no plugin:**
- `OPENCODE_OBSERVE=off` → Kill-switch geral (desliga observabilidade por completo).
- `OPENCODE_OBSERVE_DESKTOP=off` → Desliga notificações de desktop (padrão: ligado).
- `OPENCODE_OBSERVE_TOASTS=on` → Habilita toasts intrusivos na TUI (padrão: desligado).

---

## 5. Análise da Alteração do Usuário no `tui.json`

O usuário alterou no [`tui.json`](file:///home/albano/.config/opencode/tui.json#L13-L18):
```json
  "attention": {
    "enabled": true,
    "notifications": false,
    "sound": true,
    "volume": 0.4
  }
```

**Efeito técnico:**
1. `"notifications": false`: Desativa a emissão de sequências de escape de terminal nativas do OpenCode (OSC 777 / OSC 9). Isso evita notificações redundantes do terminal que dependem de suporte do emulador (Kitty, WezTerm, Ghostty).
2. `"sound": true` e `"enabled": true`: Preserva o sintetizador/player de som nativo do OpenCode, mantendo os alertas audíveis requisitados pelo usuário para eventos de atenção (`permission`, `error`, `done`, `subagent_done`).

A combinação de `"notifications": false` no `tui.json` com o novo despachante `notify-send` no plugin resulta em um sistema onde as notificações de tela ocorrem exclusivamente onde devem: no gerenciador de janelas do SO.

---

## 6. Alternativas Rejeitadas

| Alternativa | Motivo da rejeição |
|---|---|
| Manter toasts na TUI com menor duração (ex: 1s) | Ainda pisca e polui a saída de código; temporizadores não resolvem a intrusão visual |
| Instalar biblioteca npm de notificações (ex: `node-notifier`) | Adiciona dependências de terceiros no projeto; o Linux já dispõe de `notify-send` nativo no PATH |
| Depender de OSC 777 nativo do OpenCode | Suporte irregular entre emuladores de terminal e multiplexadores (`tmux`); não transmite o payload rico gerado pelo observer (ex.: nome do subagente e tempo de execução) |
