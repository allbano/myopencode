---
title: "Planejamento de Versionamento Git para Configuração OpenCode"
slug: "opencode-configs"
version: 1.0.0
status: "active"
last_reviewed: 2026-09-04
owners:
  - "@albano"
---

# Plano: Versionamento Git para Configuração OpenCode

> **Tipo:** Planejamento (PLAN)  
> **Status:** Aprovado e Executado  
> **Relacionado:** [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md), [`docs/adr/0001-opencode-configs.md`](file:///home/albano/.config/opencode/docs/adr/0001-opencode-configs.md)

---

## 1. Contexto e Motivação

A pasta `~/.config/opencode/` contém toda a configuração personalizada do usuário: agentes, permissões, skills, documentos de implementação e referências externas. Sem versionamento:

- Uma reinstalação ou atualização do opencode pode sobrescrever ou perder personalizações.
- Não há histórico de mudanças para auditoria ou rollback.
- Não há forma de sincronizar a mesma configuração entre máquinas diferentes.

**Objetivo deste planejamento:** Definir a estratégia de versionamento Git para a pasta `~/.config/opencode/`, garantindo que:
1. Nada seja perdido em reinstalações.
2. O repositório seja leve e portável.
3. Dependências externas (skills de terceiros) sejam gerenciadas corretamente.
4. O processo de restauração em uma máquina nova seja documentado e reproduzível.

---

## 2. Inventário da Pasta `~/.config/opencode/`

| Item | Tamanho | Natureza | Decisão de Versionamento |
|------|---------|----------|--------------------------|
| `opencode.jsonc` | ~2 KB | Configuração principal | ✅ Versionar |
| `AGENTS.md` | ~1 KB | Regras globais do usuário | ✅ Versionar |
| `agents/*.md` | ~15 KB | 5 agentes personalizados | ✅ Versionar |
| `commands/` | vazio | Estrutura para comandos customizados | ✅ Versionar (manter estrutura) |
| `skills/` | vazio | Estrutura para skills locais | ✅ Versionar (manter estrutura) |
| `docs/adr/` | vazio | ADRs | ✅ Versionar (manter estrutura) |
| `docs/spec/` | ~30 KB | Especificações e contratos canônicos | ✅ Versionar |
| `docs/plan/` | vazio | Planos de implementação | ✅ Versionar (manter estrutura) |
| `docs/progress/` | ~2 KB | Memória ativa de sessão | ✅ Versionar |
| `tui.json` | ~1 KB | Preferências da TUI | ✅ Versionar |
| `package.json` | ~1 KB | Dependências de plugins/skills npm | ✅ Versionar |
| `package-lock.json` | ~15 KB | Lockfile de dependências npm | ✅ Versionar |
| `node_modules/` | **62 MB** | Dependências instaladas | ❌ **Ignorar** (regenerável) |
| `vendor/agent-skills/` | **2,6 MB** | Skills de terceiros (Addy Osmani) | 🔗 **Git Submodule** |
| `.gitignore` | ~1 KB | Regras de exclusão | ✅ Versionar |

---

## 3. Decisões Arquiteturais

### 3.1 O que versionar vs. o que ignorar

**Versionar:**
- Todos os arquivos de configuração e personalização.
- `package.json` e `package-lock.json`: necessários para reinstalar plugins/skills npm de forma reproduzível.
- Estrutura de pastas mantidas no Git.

**Ignorar:**
- `node_modules/`: dependências regeneráveis com `npm install`.
- Arquivos de cache, sessões e histórico local do opencode.
- Segredos e variáveis de ambiente.

### 3.2 Tratamento de `vendor/agent-skills/` como Submodule

A pasta `vendor/agent-skills/` é um clone independente do repositório `https://github.com/addyosmani/agent-skills.git`. Em vez de copiar seus 2,6 MB para o nosso repositório:

1. **Registrar como submodule Git**: o repositório principal armazena apenas uma referência (commit hash + URL).
2. **Ao clonar em uma nova máquina**: `git submodule update --init` baixa a versão exata.
3. **Para atualizar as skills**: `cd vendor/agent-skills && git pull origin main`, depois commit no repositório principal.

---

## 4. Estratégia de Branches

```text
main (sempre estável)
  │
  ├── feature/ajustes-permissoes    ← mudanças de configuração
  ├── feature/novos-agentes         ← criação de agentes
  └── fix/correcao-docs             ← correções pontuais
```

- **Trunk-based development**: branches de curta duração.
- **Merge para main** assim que a mudança for validada.
- **Tags** para marcar versões estáveis da configuração.

---

## 5. Cenários de Risco e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|---------|-----------|
| Reinstalação do opencode sobrescreve arquivos | Média | Alto | Versionar tudo; reinstalação não apaga `.git/` |
| Conflito de `package.json` com update do opencode | Baixa | Médio | `package.json` na pasta de config é do usuário, não do opencode |
| Submodule desatualizado em máquina nova | Média | Médio | Documentar `git submodule update --init` no ADR |
| Usuário esquece de commitar mudanças | Alta | Médio | Criar alias ou hook de lembrete; documentar no ADR |
| `node_modules/` corrompido | Baixa | Baixo | Deletar e `npm install` — por isso não versionamos |

---

## 6. Histórico Semântico de Mudanças

| Versão | Data | Tipo | Descrição da Alteração |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-08-29 | INITIAL | Planejamento inicial de versionamento Git e estrutura do repositório. |

---

## 7. Referências

- [Documentação oficial do opencode — Configuração](https://opencode.ai/docs/config/)
- [Git Submodules — Documentação oficial](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- ADR relacionado: [`docs/adr/0001-opencode-configs.md`](file:///home/albano/.config/opencode/docs/adr/0001-opencode-configs.md)
- Especificação relacionada: [`docs/spec/opencode-configs.md`](file:///home/albano/.config/opencode/docs/spec/opencode-configs.md)
