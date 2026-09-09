---
title: "Janela de contexto no rodapé da TUI"
slug: "session-info-tui"
version: 1.2.0
status: "patch-prepared"
last_reviewed: 2026-09-09
owners:
  - "@albano"
---

# Especificação: Informações de Contexto no Rodapé

> **Tipo:** Especificação Técnica (SPEC)  
> **Status:** Patch preparado, ainda não instalado

## Resultado esperado

- Lado esquerdo da linha inferior: path da sessão, preservando o comportamento nativo.
- Lado direito: capacidade total da janela de contexto do modelo e percentual utilizado.
- Tokens consumidos e custo não devem aparecer nessa linha.

Exemplo: `/workspace/projeto` à esquerda e `200.0K (34%)` à direita.

## Restrição da versão 1.18.29

O slot `session_prompt_right` renderiza na linha superior de metadados do prompt. A linha inferior é implementada diretamente em `packages/tui/src/component/prompt/index.tsx` e não possui slot ou configuração de substituição.

Por isso, `plugins/session-info-tui.js` não atende este requisito. A alteração exata exige uma build do OpenCode com `patches/opencode-v1.18.29-context-window-footer.patch` aplicado.

O percentual usa os tokens registrados na última resposta concluída e a capacidade do modelo atualmente selecionado. Antes da primeira resposta, os atalhos nativos permanecem visíveis.
