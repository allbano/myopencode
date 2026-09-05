---
title: "Tarefa Ativa da Sessão de Desenvolvimento"
slug: "current-task"
version: 1.0.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Tarefa Ativa da Sessão de Desenvolvimento

* **Última Modificação:** 2026-09-04 20:55
* **Spec de Referência:** `docs/spec/opencode-configs.md`
* **Status:** Concluído

## Objetivo
Padronizar toda a pasta `docs/` conforme o **Padrão Semântico & Docs-as-Code (Opção 2)**:
- Nomes canônicos fixos em `kebab-case` sem versões no arquivo.
- Estrutura obrigatória em 4 diretórios: `docs/spec/`, `docs/plan/`, `docs/progress/`, `docs/adr/`.
- Metadados estruturados (YAML Frontmatter) com versionamento SemVer e tabela de histórico.
- Links Markdown internos atualizados e consistentes.

## Checklist de Migração
- [x] Diagnóstico dos arquivos legados fora do padrão.
- [x] Criação de `docs/progress/current-task.md` e `docs/progress/blockers.md`.
- [x] Criação dos ADRs canônicos em `docs/adr/0001-*`, `0002-*`, `0003-*`.
- [x] Criação dos planos canônicos em `docs/plan/`.
- [x] Consolidação das especificações em `docs/spec/`.
- [x] Remoção dos arquivos e diretórios legados com anti-padrão de versão no nome.
- [x] Atualização de todos os links internos cruzados.
- [x] Validação final de integridade.
