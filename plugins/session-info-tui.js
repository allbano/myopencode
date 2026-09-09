// Plugin TUI: Modelo, Contexto, Tokens e LSP Dinâmico
// Referência: docs/spec/session-info-tui.md

const id = "session-info-tui"

const tui = async (api) => {
  // ---------- Slot: session_prompt_right (rodapé) ----------
  api.slots.register({
    order: 50,
    slots: {
      session_prompt_right(_ctx, props) {
        const session = props.session_id ? api.state.session.get(props.session_id) : undefined
        const theme = api.theme.current

        // Path (lado esquerdo)
        const dir = api.state.path?.directory || "."
        const pathName = dir.split(/[\\/]/).pop() || dir

        // Modelo (tenta session.model, depois api.state.config)
        let modelName = "?"
        let variant = "default"
        let contextWindow = undefined
        let reasoning = false

        try {
          if (session?.model) {
            const provider = api.state.provider?.find?.((p) => p.id === session.model.providerID)
            const model = provider ? provider.models?.[session.model.id] : undefined
            modelName = model ? model.name : (session.model.id || "?")
            variant = session.model.variant || "default"
            contextWindow = model ? model.limit?.context : undefined
            reasoning = model ? (model.capabilities?.reasoning || false) : false
          } else if (api.state.config?.model) {
            const configModel = api.state.config.model
            modelName = configModel.includes("/") ? configModel.split("/").pop() : configModel
            variant = "default"
          }
        } catch (e) {
          // Fallback: usa valores mínimos para não quebrar a TUI
          modelName = api.state.config?.model || "?"
        }

        // Tokens (calcula da última mensagem assistente com tokens > 0)
        const messages = (api.state.session.messages?.(props.session_id) || [])
        const lastAssistant = messages.findLast ? messages.findLast((m) => m.role === "assistant" && m.tokens?.output > 0) : undefined
        let pctText = undefined
        if (lastAssistant && lastAssistant.tokens && contextWindow > 0) {
          const tokens = (lastAssistant.tokens?.input || 0) + (lastAssistant.tokens?.output || 0) + (lastAssistant.tokens?.reasoning || 0) + (lastAssistant.tokens?.cache?.read || 0) + (lastAssistant.tokens?.cache?.write || 0)
          if (tokens > 0) {
            const pct = Math.round((tokens / contextWindow) * 100)
            pctText = `${pct}%`
          }
        }

        const variantColor = reasoning ? theme.warning : theme.textMuted

        return (
          <box flexDirection="row" gap={1}>
            {/* Lado esquerdo: path */}
            <text fg={theme.textMuted}>{pathName}</text>
            <text fg={theme.textMuted}>|</text>
            {/* Lado direito: modelo, variante, contexto (ex: 1M), % de uso */}
            <text fg={theme.textMuted}>{modelName}</text>
            <text fg={variantColor}>{variant}</text>
            {contextWindow ? <text fg={theme.textMuted}>{contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}k` : contextWindow}</text> : null}
            {pctText ? <text fg={theme.accent}>{pctText}</text> : null}
          </box>
        )
      },
    },
  })

  // ---------- Slot: sidebar_content ----------
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_ctx, props) {
        const session = props.session_id ? api.state.session.get(props.session_id) : undefined
        const theme = api.theme.current

        let modelName = "?"
        let variant = "default"
        try {
          if (session?.model) {
            const provider = api.state.provider?.find?.((p) => p.id === session.model.providerID)
            const model = provider ? provider.models?.[session.model.id] : undefined
            modelName = model ? model.name : (session.model.id || "?")
            variant = session.model.variant || "default"
          } else if (api.state.config?.model) {
            const configModel = api.state.config.model
            modelName = configModel.includes("/") ? configModel.split("/").pop() : configModel
          }
        } catch (e) {
          modelName = api.state.config?.model || "?"
        }

        const tokens = session?.tokens || { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
        const cost = session?.cost || 0
        const lspStatus = api.state.lsp ? api.state.lsp() : []
        const lspActive = lspStatus.length > 0

        return (
          <box flexDirection="column" gap={1}>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Modelo:</text>
              <text fg={theme.text}>{modelName}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Variante:</text>
              <text fg={theme.text}>{variant}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Tokens in:</text>
              <text fg={theme.text}>{tokens.input || 0}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Tokens out:</text>
              <text fg={theme.text}>{tokens.output || 0}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Reasoning:</text>
              <text fg={theme.text}>{tokens.reasoning || 0}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Cache read:</text>
              <text fg={theme.text}>{tokens.cache?.read || 0}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Cache write:</text>
              <text fg={theme.text}>{tokens.cache?.write || 0}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>Custo:</text>
              <text fg={theme.accent}>${cost.toFixed(4)}</text>
            </box>
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>LSP:</text>
              <text fg={lspActive ? theme.success : theme.error}>{lspActive ? "ativo" : "inativo"}</text>
            </box>
          </box>
        )
      },
    },
  })

  // ---------- Comando: Toggle LSP ----------
  api.keymap.registerLayer({
    mode: "base",
    commands: [
      {
        name: "lsp.toggle",
        title: "Toggle LSP",
        category: "Plugin",
        namespace: "palette",
        slashName: "lsp",
        run: async () => {
          const current = api.state.config ? api.state.config.lsp : false
          const next = (current === true || (typeof current === "object" && Object.keys(current || {}).length > 0)) ? false : true
          try {
            await api.client.config.update({ body: { lsp: next } })
          } catch (e) {
            // Silencioso: o toggle é best-effort
          }
        },
      },
    ],
    bindings: [{ key: "ctrl+shift+l", cmd: "lsp.toggle", desc: "Toggle LSP" }],
  })
}

export default { id, tui }
