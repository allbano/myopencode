---
title: "Janela de contexto no rodapé da TUI"
slug: "session-info-tui"
version: 1.2.0
status: "patch-prepared"
last_reviewed: 2026-09-09
owners:
  - "@albano"
---

# Plano: Janela de Contexto no Rodapé da TUI

> **Tipo:** Planejamento (PLAN)  
> **Status:** Patch preparado; instalação não autorizada  
> **Origem:** Requisito do usuário

---

## 1. Tarefas

| ID | Tarefa | Estado | Evidência |
|---|---|---|---|
| T1 | Identificar o renderer real da linha inferior | Concluída | `Prompt.usage()` e JSX do rodapé em `packages/tui/src/component/prompt/index.tsx` |
| T2 | Confirmar se um plugin externo pode substituir o valor | Concluída | `session_prompt_right` atua na linha superior; não há slot no rodapé |
| T3 | Preparar patch mínimo para a versão 1.18.29 | Concluída | `patches/opencode-v1.18.29-context-window-footer.patch` |
| T4 | Validar aplicação, typecheck, testes e build | Concluída | Patch aplica limpo; pacote TUI passa typecheck e 193 testes; build gera binário |
| T5 | Instalar a build customizada | Não autorizada | Usuário escolheu somente preparar o patch |
