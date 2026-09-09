---
title: "Patch nativo para contexto no rodapé da TUI"
slug: "session-info-tui"
version: 2.0.0
status: "accepted"
last_reviewed: 2026-09-09
owners:
  - "@albano"
---

# ADR 0005: Patch Nativo para Contexto no Rodapé da TUI

> **Tipo:** Architecture Decision Record (ADR)  
> **Status:** Aceito; patch preparado e não instalado

## Contexto

O rodapé nativo do OpenCode 1.18.29 mostra a soma de tokens da última resposta e o percentual de uso. O requisito é manter o path à esquerda e mostrar à direita a capacidade total da janela de contexto e o percentual utilizado.

A tentativa anterior usou `session_prompt_right`, mas esse slot é renderizado na linha superior de metadados. A linha inferior não possui slot, prop ou opção de configuração. Portanto, o plugin não consegue substituir o valor nativo.

## Decisão

Preparar um patch mínimo e específico para a versão 1.18.29 em `patches/opencode-v1.18.29-context-window-footer.patch`. O patch usa `model.limit.context` do modelo atualmente selecionado, preserva o percentual calculado a partir dos tokens da última resposta e remove o custo da linha inferior.

Uma build customizada só será instalada mediante autorização explícita. Atualizações do OpenCode exigirão verificar e possivelmente reaplicar o patch.
